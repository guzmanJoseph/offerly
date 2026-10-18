
/*
 * Offerly autofill controller.
 * Works with original formEngine.js from commit 12ec071.
 */
(() => {
  const BASE =
    'https://cezdzqaayzlalspukapl.supabase.co';

  const KEY =
    'sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir';

  const $ = id => document.getElementById(id);

  const norm = s =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  let tabId = null;

  const status = s => {
    if ($('status')) {
      $('status').textContent = s;
    }
  };

  async function row(table, columns) {
    const session = await getValidSession();

    if (
      !session?.user?.id ||
      !session.access_token
    ) {
      throw Error(
        'Log in to Offerly first.'
      );
    }

    const q = new URLSearchParams({
      select: columns,
      user_id: `eq.${session.user.id}`,
      limit: '1'
    });

    const res = await fetch(
      `${BASE}/rest/v1/${table}?${q}`,
      {
        headers: {
          apikey: KEY,
          Authorization:
            `Bearer ${session.access_token}`
        }
      }
    );

    if (!res.ok) {
      throw Error(
        `Could not load ${table} (${res.status})`
      );
    }

    return (await res.json())[0] || null;
  }

  async function profileData() {
    const data = (
      await row(
        'autofill_profiles',
        'profile_data'
      )
    )?.profile_data;

    if (!data) {
      throw Error(
        'Save your Offerly autofill profile first.'
      );
    }

    return data;
  }

  async function selfIdentification() {
    try {
      const r = await row(
        'autofill_self_identification',
        'answers,allow_suggestions,auto_fill_enabled'
      );

      return {
        answers: r?.answers || {},
        allowSuggestions:
          Boolean(r?.allow_suggestions),
        autoFillEnabled:
          Boolean(r?.auto_fill_enabled)
      };
    } catch (e) {
      console.warn(
        'Offerly sensitive preferences unavailable',
        e
      );

      return {
        answers: {},
        allowSuggestions: false,
        autoFillEnabled: false
      };
    }
  }

  async function prepare() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (
      !tab?.id ||
      !/^https?:\/\//.test(tab.url || '')
    ) {
      throw Error(
        'Open a job application webpage first.'
      );
    }

    tabId = tab.id;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['formEngine.js'],
      world: 'ISOLATED'
    });

    const result =
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',
        func: () => ({
          ready:
            typeof globalThis.offerlyEngine
              ?.scan === 'function',
          methods:
            Object.keys(
              globalThis.offerlyEngine || {}
            )
        })
      });

    if (!result?.[0]?.result?.ready) {
      throw Error(
        'formEngine.js did not initialize. Restore the original working file.'
      );
    }
  }

  async function call(method, ...args) {
    const result =
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',

        func: async (name, params) => {
          const fn =
            globalThis.offerlyEngine?.[name];

          if (typeof fn !== 'function') {
            throw Error(
              `Missing engine method: ${name}`
            );
          }

          return await fn(...params);
        },

        args: [method, args]
      });

    return result?.[0]?.result;
  }

  async function run(method, ...args) {
    const driver = window.offerlyDropdownDriver;

    if (
      driver &&
      (
        method === 'getDropdownOptions' ||
        method === 'fillAnswer'
      )
    ) {
      const fields = await call('scan');

      const field = Array.isArray(fields)
        ? fields.find(
            f => f.id === args[0]
          )
        : null;

      if (field?.type === 'custom') {
        return method === 'getDropdownOptions'
          ? driver.openAndRead(
              tabId,
              args[0]
            )
          : driver.fill(
              tabId,
              args[0],
              args[1]
            );
      }
    }

    return call(method, ...args);
  }

  async function scan() {
    try {
      const result = await call('scan');

      if (!Array.isArray(result)) {
        throw Error(
          'Scanner did not return an array'
        );
      }

      return {
        ok: true,
        fields: result
      };
    } catch (error) {
      console.warn(
        'Offerly question scan failed; continuing',
        error
      );

      return {
        ok: false,
        fields: []
      };
    }
  }

  async function additionalEngine(
    filename,
    globalName,
    profile,
    selfId
  ) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [filename],
        world: 'ISOLATED'
      });

      const r =
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'ISOLATED',

          func: async (name, p, s) => {
            const fn = globalThis[name]?.apply;

            if (typeof fn !== 'function') {
              throw Error(
                `${name} not initialized`
              );
            }

            return await fn(p, s);
          },

          args: [globalName, profile, selfId]
        });

      const result =
        r?.[0]?.result || {
          filled: 0,
          skipped: 0,
          failed: ['No result']
        };

      console.info(
        'Offerly ' + globalName,
        result
      );

      return result;
    } catch (error) {
      console.warn(
        'Offerly ' + globalName + ' failed',
        error
      );

      return {
        filled: 0,
        skipped: 0,
        failed: [
          String(error.message || error)
        ]
      };
    }
  }

  async function defaultResume() {
    const stored = (
      await row(
        'resume_preferences',
        'default_resume_name'
      )
    )?.default_resume_name;

    if (!stored) return null;

    if (
      stored.includes('/') ||
      stored.includes('\\') ||
      stored === '.' ||
      stored === '..'
    ) {
      throw Error(
        'Invalid resume filename'
      );
    }

    const session = await getValidSession();

    const path = [
      session.user.id,
      stored
    ]
      .map(encodeURIComponent)
      .join('/');

    const response = await fetch(
      `${BASE}/storage/v1/object/authenticated/resumes/${path}`,
      {
        headers: {
          apikey: KEY,
          Authorization:
            `Bearer ${session.access_token}`
        }
      }
    );

    if (!response.ok) {
      throw Error(
        `Resume download failed (${response.status})`
      );
    }

    const blob = await response.blob();

    if (
      !blob.size ||
      blob.size > 5 * 1024 * 1024
    ) {
      throw Error(
        'Resume must be 1 byte to 5 MB'
      );
    }

    const filename =
      stored.includes('__')
        ? stored.split('__')
            .slice(1)
            .join('__')
        : stored;

    if (!/\.(pdf|docx)$/i.test(filename)) {
      throw Error(
        'Resume must be PDF or DOCX'
      );
    }

    return {
      filename,
      mime:
        /\.pdf$/i.test(filename)
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: Array.from(
        new Uint8Array(
          await blob.arrayBuffer()
        )
      )
    };
  }

  function review(fields, scanOK, extras) {
    $('offerlyQuestionReview')?.remove();

    const missing = fields
      .filter(
        f =>
          f &&
          f.type !== 'file' &&
          f.type !== 'choice' &&
          !String(f.value || '').trim() &&
          (
            f.required ||
            f.sensitive ||
            f.employmentQuestion ||
            ['select', 'custom'].includes(f.type)
          )
      )
      .map(f => f.label)
      .filter(
        x =>
          x &&
          !/^(search|off|field \d+)/i.test(x)
      );

    if (!scanOK) {
      missing.push(
        'Question scan incomplete — review fields manually'
      );
    }

    missing.push(...extras);

    const unique = [
      ...new Map(
        missing
          .filter(Boolean)
          .map(x => [
            norm(x),
            x
          ])
      ).values()
    ];

    const section =
      document.createElement('section');

    section.id = 'offerlyQuestionReview';
    section.className = 'offerly-review';

    const heading =
      document.createElement('h3');

    heading.textContent = unique.length
      ? `Needs your attention (${unique.length})`
      : 'Autofill review';

    section.appendChild(heading);

    const p =
      document.createElement('p');

    p.textContent = unique.length
      ? 'Review these items on the application:'
      : 'Review the entire application before submitting.';

    section.appendChild(p);

    if (unique.length) {
      const ul =
        document.createElement('ul');

      ul.className = 'offerly-missing-list';

      for (const s of unique) {
        const li =
          document.createElement('li');

        li.textContent = s;
        ul.appendChild(li);
      }

      section.appendChild(ul);
    }

    $('autofillBtn')?.insertAdjacentElement(
      'afterend',
      section
    );

    return unique.length;
  }

  async function handle() {
    const btn = $('autofillBtn');

    if (!btn || btn.disabled) return;

    btn.disabled = true;

    $('offerlyQuestionReview')?.remove();

    try {
      status('Loading Offerly profile…');

      const [profile, selfId] =
        await Promise.all([
          profileData(),
          selfIdentification()
        ]);

      await prepare();

      let text = { filled: 0 };

      try {
        status('Filling contact information…');

        text =
          await run(
            'fillText',
            profile
          ) || text;
      } catch (e) {
        console.warn(
          'Offerly contact autofill',
          e
        );
      }

      const first = await scan();

      let smart = {
        filled: 0,
        skipped: [],
        failed: []
      };

      if (
        first.ok &&
        window.offerlySmartAnswers?.apply
      ) {
        try {
          status(
            'Matching saved dropdown answers…'
          );

          smart =
            await window.offerlySmartAnswers.apply({
              fields: first.fields,
              profile,
              selfId,
              tabId,
              runEngine: run
            }) || smart;
        } catch (e) {
          console.warn(
            'Offerly smart answers',
            e
          );
        }
      }

      status(
        'Selecting matching buttons and dropdowns…'
      );

      const controls =
        await additionalEngine(
          'universalControls.js',
          'offerlyUniversalControls',
          profile,
          selfId
        );

      status(
        'Selecting supported calendar dates…'
      );

      const calendar =
        await additionalEngine(
          'calendarDriver.js',
          'offerlyCalendarDriver',
          profile,
          selfId
        );

      let resumeMessage =
        'No default resume selected.';

      try {
        status('Attaching resume…');

        const resume =
          await defaultResume();

        if (resume) {
          const outcome = await call(
            'attachResume',
            resume.bytes,
            resume.filename,
            resume.mime
          );

          resumeMessage = outcome?.ok
            ? `${resume.filename} selected — verify upload.`
            : `Resume needs review: ${
                outcome?.reason || 'Not confirmed'
              }`;
        }
      } catch (e) {
        console.warn(
          'Offerly resume upload',
          e
        );

        resumeMessage =
          `Resume issue: ${e.message}`;
      }

      const last = await scan();

      const failed = [
        ...controls.failed,
        ...calendar.failed
      ];

      const count = review(
        last.fields,
        last.ok,
        failed.length
          ? [
              'Some controls could not be filled — review manually'
            ]
          : []
      );

      const filled = [
        text,
        smart,
        controls,
        calendar
      ].reduce(
        (sum, item) =>
          sum + (Number(item?.filled) || 0),
        0
      );

      status(
        `${filled} fields filled. ` +
        `${count} items need review. ` +
        resumeMessage
      );

      console.info(
        'Offerly autofill summary',
        {
          text,
          smart,
          controls,
          calendar,
          resumeMessage
        }
      );
    } catch (e) {
      console.error(
        'Offerly autofill failed',
        e
      );

      status(
        e.message || 'Autofill failed'
      );
    } finally {
      btn.disabled = false;
    }
  }

  $('autofillBtn')?.addEventListener(
    'click',
    handle
  );
})();
