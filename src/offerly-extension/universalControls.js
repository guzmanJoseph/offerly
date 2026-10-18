
/*
 * Offerly universal controls:
 * Conservative, saved-answer-only form interaction.
 */
(() => {
  const norm = v => String(v ?? '')
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const pause = ms =>
    new Promise(r => setTimeout(r, ms));

  const visible = el => !!(
    el?.isConnected &&
    !el.disabled &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).display !== 'none' &&
    el.getClientRects().length
  );

  const SENSITIVE = new Set([
    'race', 'ethnicity', 'gender',
    'veteranStatus', 'disabilityStatus',
    'hispanicLatino', 'pronouns'
  ]);

  const PROTECTED =
    /consent|privacy|terms|certif|attest|signature|captcha|recaptcha|submit|apply now|subscribe|marketing|newsletter|agreement|authorize|permission to/i;

  function label(el) {
    const vals = [...(el.labels || [])]
      .map(l => l.textContent);

    for (const id of (
      el.getAttribute('aria-labelledby') || ''
    ).split(/\s+/)) {
      if (id) {
        vals.push(
          document.getElementById(id)?.textContent
        );
      }
    }

    const wrap = el.closest(
      'fieldset,[role="radiogroup"],' +
      '[data-automation-id="formField"],' +
      '.form-group,.form-field,.field,.input-wrapper'
    );

    if (wrap) {
      const legend = wrap.querySelector(
        'legend,[data-automation-id="formLabel"]'
      );

      if (legend) {
        vals.push(legend.textContent);
      } else if (
        wrap.querySelectorAll(
          'input,select,textarea,[role="combobox"]'
        ).length === 1
      ) {
        vals.push(
          wrap.querySelector('label')?.textContent
        );
      }
    }

    vals.push(
      el.getAttribute('aria-label'),
      el.getAttribute('data-placeholder'),
      el.getAttribute('placeholder'),
      el.name,
      el.id
    );

    if (el.type === 'radio') {
      const group = el.closest(
        'fieldset,[role="radiogroup"],' +
        '[data-automation-id="formField"],' +
        '.form-group,.form-field'
      );

      const groupLabel = group?.querySelector(
        'legend,[data-automation-id="formLabel"]'
      )?.textContent;

      if (groupLabel) return groupLabel.trim();
    }

    return vals
      .map(s => String(s || '').trim())
      .find(Boolean) || '';
  }

  function keyFor(text) {
    const s = norm(text);

    if (/hispanic|latino/.test(s))
      return 'hispanicLatino';

    if (/veteran/.test(s))
      return 'veteranStatus';

    if (/disabil/.test(s))
      return 'disabilityStatus';

    if (/ethnic/.test(s))
      return 'ethnicity';

    if (/\brace\b|racial/.test(s))
      return 'race';

    if (/gender|^sex$/.test(s))
      return 'gender';

    if (/pronouns?/.test(s))
      return 'pronouns';

    if (/country of residence|^country$/.test(s))
      return 'country';

    if (/^state$|^province$|state or province/.test(s))
      return 'state';

    if (/how did you.*(hear|find|learn)/.test(s))
      return 'referralSource';

    if (/graduation date|graduation month|graduation year/.test(s))
      return 'graduationDate';

    if (/date of birth|birth date|birthday|^dob$/.test(s))
      return 'dateOfBirth';

    if (/available start date|earliest start date/.test(s))
      return 'availableStartDate';

    return null;
  }

  function saved(key, profile, selfId) {
    if (
      SENSITIVE.has(key) &&
      !selfId?.autoFillEnabled
    ) {
      return null;
    }

    const answers = selfId?.answers || {};

    const map = {
      race: answers.race,
      ethnicity: answers.ethnicity,
      gender: answers.gender,
      veteranStatus: answers.veteranStatus,
      disabilityStatus: answers.disabilityStatus,
      hispanicLatino: answers.hispanicLatino,
      pronouns: answers.pronouns || profile.pronouns,
      country: profile.country,
      state: profile.state || profile.region,
      referralSource: profile.referralSource,
      graduationDate: profile.graduationDate,
      dateOfBirth: profile.dateOfBirth,
      availableStartDate: profile.availableStartDate
    };

    return map[key] ?? null;
  }

  function selected(el) {
    if (el.tagName === 'SELECT') {
      return !!el.selectedOptions[0]?.value &&
        !/^(select|choose|please select)$/i.test(
          el.selectedOptions[0]?.textContent.trim() || ''
        );
    }

    if (el.matches(
      'input[type="radio"],input[type="checkbox"]'
    )) {
      return el.checked;
    }

    
const text = (
  el.getAttribute('data-value') ||
  el.getAttribute('value') ||
  el.value ||
  el.querySelector(
    '[data-radix-select-value]'
  )?.textContent ||
  el.textContent ||
  ''
).trim();


    return !!text &&
      !/^(select|select\.\.\.|choose|choose\.\.\.|please select|-- select --)$/i.test(text);
  }

  function exactOption(options, answer) {
    const a = norm(answer);

    const matching = options.filter(
      o =>
        norm(o.label) === a ||
        norm(o.value) === a
    );

    return matching.length === 1
      ? matching[0]
      : null;
  }

  function nativeSelect(el, answer) {
    if (selected(el)) return false;

    const match = exactOption(
      [...el.options]
        .filter(o => !o.disabled)
        .map(o => ({
          label: o.textContent,
          value: o.value
        })),
      answer
    );

    if (!match) return false;

    const setter =
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;

    if (setter) {
      setter.call(el, match.value);
    } else {
      el.value = match.value;
    }

    el.dispatchEvent(
      new Event('input', { bubbles: true })
    );

    el.dispatchEvent(
      new Event('change', { bubbles: true })
    );

    return el.value === match.value;
  }

  function radio(el, answer) {
    const group = el.closest(
      'fieldset,[role="radiogroup"],' +
      '[data-automation-id="formField"],' +
      '.form-group,.form-field'
    );

    if (!group || !el.name) return false;

    const radios = [
      ...group.querySelectorAll(
        'input[type="radio"]'
      )
    ].filter(r => r.name === el.name);

    if (
      radios.length < 2 ||
      radios.some(r => r.checked)
    ) {
      return false;
    }

    const match = exactOption(
      radios.map(r => ({
        label: [...(r.labels || [])]
          .map(x => x.textContent)
          .join(' ') ||
          r.getAttribute('aria-label') ||
          r.value,
        value: r.value,
        el: r
      })),
      answer
    );

    if (!match || !visible(match.el)) {
      return false;
    }

    match.el.click();
    return match.el.checked;
  }

  function checkbox(el, answer) {
    const group = el.closest(
      'fieldset,[data-automation-id="formField"],' +
      '.form-group,.form-field'
    );

    if (
      !group ||
      group.querySelectorAll(
        'input[type="checkbox"]'
      ).length !== 1
    ) {
      return false;
    }

    const val =
      typeof answer === 'boolean'
        ? answer
        : /^(yes|true)$/i.test(String(answer))
        ? true
        : /^(no|false)$/i.test(String(answer))
        ? false
        : null;

    if (
      val === null ||
      el.checked === val
    ) {
      return false;
    }

    el.click();
    return el.checked === val;
  }

  async function custom(el, answer) {
    if (selected(el)) return false;

    
el.focus();
el.click();

el.dispatchEvent(
  new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    code: 'ArrowDown',
    bubbles: true,
    cancelable: true
  })
);

await pause(350);


    const id =
      el.getAttribute('aria-controls') ||
      el.getAttribute('aria-owns');

    const direct = id
      ? document.getElementById(id)
      : null;

    const roots =
      direct && visible(direct)
        ? [direct]
        : [
            ...document.querySelectorAll(
              '[role="listbox"],' +
              '.select__menu-list,' +
              '[class*="__menu-list"],' +
              '[data-radix-select-viewport]'
            )
          ].filter(visible);

    if (roots.length !== 1) return false;

    const options = [
      ...roots[0].querySelectorAll(
        '[role="option"],' +
        '.select__option,' +
        '[class*="__option"],' +
        '[data-radix-select-item]'
      )
    ]
      .filter(visible)
      .filter(
        o =>
          o.getAttribute('aria-disabled') !== 'true'
      )
      .map(o => ({
        label:
          o.getAttribute('aria-label') ||
          o.textContent,
        value:
          o.getAttribute('data-value') ||
          o.textContent,
        el: o
      }));

    const match = exactOption(options, answer);

    if (!match) {
      el.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true
        })
      );
      return false;
    }

    match.el.click();
    await pause(200);

    return (
      norm(el.textContent) === norm(match.label) ||
      match.el.getAttribute('aria-selected') === 'true' ||
      norm(el.getAttribute('data-value')) === norm(answer)
    );
  }

  async function apply(profile = {}, selfId = {}) {
    const result = {
      filled: 0,
      skipped: 0,
      failed: []
    };

    const seen = new Set();

    
const controls = [
  ...document.querySelectorAll(
    'select:not([class*="hidden"]),' +
    'input[type="radio"],' +
    'input[type="checkbox"],' +
    'button[aria-haspopup="listbox"],' +
    '[role="combobox"],' +
    'input[aria-haspopup="true"],' +
    'button[aria-haspopup="true"]'
  )
];


    for (const el of controls) {
      if (!visible(el)) continue;

      const fieldLabel = label(el);
      const key = keyFor(fieldLabel);

      if (
        !key ||
        PROTECTED.test(norm(fieldLabel))
      ) {
        continue;
      }

      const answer = saved(
        key,
        profile,
        selfId
      );

      if (
        answer === null ||
        answer === undefined ||
        answer === ''
      ) {
        continue;
      }

      const identity =
        el.type === 'radio'
          ? `${key}:${el.name}:${
              el.closest(
                'fieldset,[role="radiogroup"],' +
                '.form-group,.form-field'
              )?.outerHTML.slice(0, 70)
            }`
          : null;

      if (identity && seen.has(identity)) {
        continue;
      }

      if (identity) seen.add(identity);

      try {
        let ok = false;

        if (el.matches('select')) {
          ok = nativeSelect(el, answer);
        } else if (el.type === 'radio') {
          ok = radio(el, answer);
        } else if (el.type === 'checkbox') {
          ok = checkbox(el, answer);
        } else {
          ok = await custom(el, answer);
        }

        if (ok) {
          result.filled++;
        } else {
          result.skipped++;
        }
      } catch (e) {
        result.failed.push({
          field: fieldLabel,
          reason: String(e.message || e)
        });
      }
    }

    return result;
  }

  globalThis.offerlyUniversalControls = {
    apply
  };
})();
