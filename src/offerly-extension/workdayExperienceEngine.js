
/*
 * Offerly Workday Experience Engine
 * Fills saved work experience and education.
 * Does not submit applications.
 */

(() => {
  const clean = (v) =>
    String(v ?? "").replace(/\s+/g, " ").trim();

  const norm = (v) =>
    clean(v).toLowerCase().replace(/\*/g, "");

  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  function visible(el) {
    if (!el?.isConnected) return false;

    const s = getComputedStyle(el);

    return (
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      !!el.getClientRects().length
    );
  }

  function controls(root) {
    return [
      ...root.querySelectorAll(
        "input, textarea, select, " +
        "button[aria-haspopup='listbox']"
      ),
    ].filter(
      (el) =>
        visible(el) &&
        !el.disabled &&
        ![
          "hidden",
          "checkbox",
          "radio",
          "file",
          "submit",
        ].includes(el.type) &&
        !(
          el.tagName === "INPUT" &&
          el.previousElementSibling?.matches(
            "button[aria-haspopup='listbox']"
          )
        )
    );
  }

  function section(title) {
    const heading = [
      ...document.querySelectorAll(
        "h2,h3,h4,h5,h6,[role='heading']"
      ),
    ].find(
      (el) => norm(el.textContent) === norm(title)
    );

    if (!heading) return null;

    for (
      let p = heading.parentElement, depth = 0;
      p && depth < 10;
      p = p.parentElement, depth++
    ) {
      if (p === document.body) break;
      if (controls(p).length < 2) continue;

      const headings = [
        ...p.querySelectorAll(
          "h2,h3,h4,h5,h6,[role='heading']"
        ),
      ].filter((el) =>
        /^(?:work experience|education)\s+\d+$/i.test(
          clean(el.textContent)
        )
      );

      if (headings.length === 1) return p;
    }

    return null;
  }

  function labelsOf(el, root) {
    const values = [];

    const add = (v) => {
      const x = norm(v);

      if (x && !values.includes(x)) {
        values.push(x);
      }
    };

    for (const l of el.labels || []) {
      add(l.textContent);
    }

    for (const id of (
      el.getAttribute("aria-labelledby") || ""
    ).split(/\s+/)) {
      if (id) {
        add(document.getElementById(id)?.textContent);
      }
    }

    add(el.getAttribute("aria-label"));

    if (el.id) {
      const linked = [
        ...root.querySelectorAll("label[for]"),
      ].find(
        (l) => l.getAttribute("for") === el.id
      );

      if (linked) add(linked.textContent);
    }

    add(el.getAttribute("placeholder"));

    for (
      let p = el.parentElement, n = 0;
      p && p !== root && n < 5;
      p = p.parentElement, n++
    ) {
      if (controls(p).length === 1) {
        const l = p.querySelector(
          "label, [data-automation-id='fieldLabel']"
        );

        if (l) add(l.textContent);
      }
    }

    return values;
  }

  function findField(
    root,
    name,
    test = () => true
  ) {
    if (!root) return null;

    const matches = controls(root).filter(
      (el) =>
        test(el) &&
        labelsOf(el, root).includes(norm(name))
    );

    return matches.length === 1
      ? matches[0]
      : null;
  }

  function nativeSet(el, value) {
    const proto =
      el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const setter =
      Object.getOwnPropertyDescriptor(
        proto,
        "value"
      )?.set;

    if (!setter) return false;

    setter.call(el, String(value));

    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertReplacementText",
        data: String(value),
      })
    );

    el.dispatchEvent(
      new Event("change", {
        bubbles: true,
      })
    );

    return true;
  }

  async function setText(el, value) {
    if (
      !el ||
      !visible(el) ||
      el.disabled ||
      el.readOnly ||
      !clean(value) ||
      !["INPUT", "TEXTAREA"].includes(el.tagName)
    ) {
      return false;
    }

    const desired = String(value).trim();

    if (el.value === desired) return true;

    el.focus();

    if (!nativeSet(el, desired)) return false;

    el.blur();

    await wait(180);

    return (
      el.isConnected &&
      el.value === desired
    );
  }

  // -----------------------------------
  // DATE PARSING
  // -----------------------------------

  function monthYear(value) {
    const text = clean(value);

    let m = text.match(
      /^(\d{1,2})\/(\d{4})$/
    );

    if (
      m &&
      +m[1] >= 1 &&
      +m[1] <= 12
    ) {
      return (
        `${m[1].padStart(2, "0")}/${m[2]}`
      );
    }

    m = text.match(
      /^(\d{4})-(\d{1,2})$/
    );

    if (m) {
      return monthYear(
        `${m[2]}/${m[1]}`
      );
    }

    m = text.match(
      /^([a-z]+)\.?\s+(\d{4})$/i
    );

    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };

    if (
      m &&
      months[
        m[1].slice(0, 3).toLowerCase()
      ]
    ) {
      return monthYear(
        `${
          months[
            m[1].slice(0, 3).toLowerCase()
          ]
        }/${m[2]}`
      );
    }

    return "";
  }

  function datesOf(item) {
    const pieces = clean(item.date).split(
      /\s+(?:to|-|–|—)\s+/i
    );

    const rawEnd = clean(
      item.endDate || pieces[1]
    );

    const current =
      item.currentlyWorking === true ||
      /^(present|current|now)$/i.test(
        rawEnd
      );

    return {
      start: monthYear(
        item.startDate || pieces[0]
      ),

      end: current
        ? ""
        : monthYear(rawEnd),

      current,
    };
  }

  function yearOf(value) {
    const m = clean(value).match(
      /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/
    );

    return m ? m[1] : "";
  }

  function note(result, message) {
    result.needsAttention.push(message);
  }

  function success(result, message) {
    result.filled++;
    result.fields.push(message);
  }

  // -----------------------------------
  // ORDINARY TEXT FIELDS
  // -----------------------------------

  async function write(
    root,
    name,
    value,
    result,
    prefix
  ) {
    if (!clean(value)) return;

    const el = findField(
      root,
      name,
      (x) =>
        ["INPUT", "TEXTAREA"].includes(
          x.tagName
        ) &&
        x.getAttribute("role") !==
          "spinbutton"
    );

    if (
      el &&
      (await setText(el, value))
    ) {
      success(
        result,
        `${prefix}: ${name}`
      );
    } else {
      note(
        result,
        `${prefix}: ${name}`
      );
    }
  }

  // -----------------------------------
  // WORKDAY MONTH/YEAR SPINBUTTONS
  // -----------------------------------

  async function setSpin(el, value) {
    if (
      !el ||
      !visible(el) ||
      el.disabled ||
      el.readOnly
    ) {
      return false;
    }

    const wanted = String(
      Number(value)
    );

    if (!/^\d+$/.test(wanted)) {
      return false;
    }

    if (
      Number(el.value) ===
        Number(wanted) &&
      (
        !el.hasAttribute(
          "aria-valuenow"
        ) ||
        Number(
          el.getAttribute(
            "aria-valuenow"
          )
        ) === Number(wanted)
      )
    ) {
      return true;
    }

    el.focus();

    if (!nativeSet(el, wanted)) {
      return false;
    }

    el.blur();

    await wait(250);

    return (
      el.isConnected &&
      Number(el.value) ===
        Number(wanted) &&
      (
        !el.hasAttribute(
          "aria-valuenow"
        ) ||
        Number(
          el.getAttribute(
            "aria-valuenow"
          )
        ) === Number(wanted)
      )
    );
  }

  async function setWorkDate(
    root,
    part,
    value
  ) {
    const m = monthYear(value).match(
      /^(\d{2})\/(\d{4})$/
    );

    if (!m) return false;

    const month = [
      ...root.querySelectorAll(
        "input[role='spinbutton']"
      ),
    ].filter((el) =>
      el.id.endsWith(
        `--${part}-dateSectionMonth-input`
      )
    );

    const year = [
      ...root.querySelectorAll(
        "input[role='spinbutton']"
      ),
    ].filter((el) =>
      el.id.endsWith(
        `--${part}-dateSectionYear-input`
      )
    );

    if (
      month.length !== 1 ||
      year.length !== 1
    ) {
      return false;
    }

    const a = await setSpin(
      month[0],
      m[1]
    );

    const b = await setSpin(
      year[0],
      m[2]
    );

    return a && b;
  }

  // -----------------------------------
  // EDUCATION YEAR FIELDS
  // -----------------------------------

  async function setSchoolYear(
    root,
    part,
    value
  ) {
    const year = yearOf(value);

    if (!year) return false;

    const matches = [
      ...root.querySelectorAll(
        "input[role='spinbutton']"
      ),
    ].filter((el) =>
      el.id.endsWith(
        `--${part}-dateSectionYear-input`
      )
    );

    return (
      matches.length === 1 &&
      await setSpin(
        matches[0],
        year
      )
    );
  }

  // -----------------------------------
  // SCHOOL SELECTION
  // -----------------------------------

  function selectedSchool(root, name) {
    const wanted = norm(name);

    return [
      ...root.querySelectorAll(
        "[data-automation-id='promptAriaInstruction'], " +
        "[data-automation-id='selectedItem'], " +
        "[data-automation-id='selectedItemText']"
      ),
    ].some(
      (el) =>
        norm(el.textContent).replace(
          /^\d+ items? selected,?\s*/i,
          ""
        ) === wanted
    );
  }

  async function fillSchool(
    root,
    name
  ) {
    if (!clean(name)) return false;

    // Workday clears the search input
    // after a school has been selected.
    if (
      selectedSchool(root, name)
    ) {
      return true;
    }

    const input =
      root.querySelector(
        "input[data-uxi-widget-type='selectinput'][id$='--school']"
      ) ||
      findField(
        root,
        "School or University",
        (el) =>
          el.tagName === "INPUT"
      );

    if (
      !input ||
      !visible(input)
    ) {
      return false;
    }

    input.focus();
    input.click();

    if (
      !nativeSet(input, name)
    ) {
      return false;
    }

    await wait(400);

    for (
      let attempt = 0;
      attempt < 6;
      attempt++
    ) {
      const options = [
        ...document.querySelectorAll(
          "[role='option'], " +
          "[role='listbox'] li"
        ),
      ].filter(
        (el) =>
          visible(el) &&
          norm(el.textContent) ===
            norm(name)
      );

      if (options.length === 1) {
        options[0].click();

        await wait(300);

        return selectedSchool(
          root,
          name
        );
      }

      await wait(180);
    }

    return false;
  }

  // -----------------------------------
  // DEGREE DROPDOWN
  // -----------------------------------

  function optionNodes(button) {
    const id = button.getAttribute(
      "aria-controls"
    );

    const owned = id
      ? document.getElementById(id)
      : null;

    const menus =
      owned && visible(owned)
        ? [owned]
        : [
            ...document.querySelectorAll(
              "[role='listbox']"
            ),
          ].filter(visible);

    if (menus.length !== 1) {
      return [];
    }

    return [
      ...menus[0].querySelectorAll(
        "[role='option']"
      ),
    ].filter(
      (el) =>
        visible(el) &&
        el.getAttribute(
          "aria-disabled"
        ) !== "true"
    );
  }

  async function fillDegree(
    root,
    desired
  ) {
    if (!clean(desired)) {
      return false;
    }

    const button = [
      ...root.querySelectorAll(
        "button[aria-haspopup='listbox']"
      ),
    ].find(
      (el) =>
        visible(el) &&
        /--degree$/.test(el.id)
    );

    if (button) {
      if (
        norm(button.textContent) ===
        norm(desired)
      ) {
        return true;
      }

      if (
        button.getAttribute(
          "aria-expanded"
        ) !== "true"
      ) {
        button.click();
      }

      await wait(250);

      const matches = optionNodes(
        button
      ).filter(
        (el) =>
          norm(el.textContent) ===
          norm(desired)
      );

      if (
        matches.length !== 1
      ) {
        return false;
      }

      matches[0].click();

      await wait(250);

      return (
        norm(button.textContent) ===
        norm(desired)
      );
    }

    // Fallback for native select fields.
    const select = findField(
      root,
      "Degree",
      (el) =>
        el.tagName === "SELECT"
    );

    if (!select) return false;

    const matches = [
      ...select.options,
    ].filter(
      (el) =>
        !el.disabled &&
        norm(el.textContent) ===
          norm(desired)
    );

    if (
      matches.length !== 1
    ) {
      return false;
    }

    select.value =
      matches[0].value;

    select.dispatchEvent(
      new Event("input", {
        bubbles: true,
      })
    );

    select.dispatchEvent(
      new Event("change", {
        bubbles: true,
      })
    );

    await wait(200);

    return (
      select.value ===
      matches[0].value
    );
  }

  // -----------------------------------
  // MAIN AUTOFILL
  // -----------------------------------

  async function fill(profile = {}) {
    const result = {
      filled: 0,
      fields: [],
      needsAttention: [],
    };

    const jobs = Array.isArray(
      profile.experience
    )
      ? profile.experience
      : [];

    const schools = Array.isArray(
      profile.education
    )
      ? profile.education
      : [];

    // WORK EXPERIENCE

    for (
      const [index, job]
      of jobs.entries()
    ) {
      const prefix =
        `Work Experience ${index + 1}`;

      const root = section(prefix);

      if (!root) {
        note(
          result,
          `${prefix}: Section not found`
        );
        continue;
      }

      // Preserve working fields.
      await write(
        root,
        "Job Title",
        job.jobTitle,
        result,
        prefix
      );

      await write(
        root,
        "Company",
        job.company,
        result,
        prefix
      );

      await write(
        root,
        "Location",
        job.location,
        result,
        prefix
      );

      await write(
        root,
        "Role Description",
        job.description,
        result,
        prefix
      );

      const dates = datesOf(job);

      // FROM DATE
      if (dates.start) {
        if (
          await setWorkDate(
            root,
            "startDate",
            dates.start
          )
        ) {
          success(
            result,
            `${prefix}: From date`
          );
        } else {
          note(
            result,
            `${prefix}: Confirm From date`
          );
        }
      } else {
        note(
          result,
          `${prefix}: From date missing in saved profile`
        );
      }

      // TO DATE
      if (dates.current) {
        note(
          result,
          `${prefix}: Confirm 'I currently work here'`
        );
      } else if (dates.end) {
        if (
          await setWorkDate(
            root,
            "endDate",
            dates.end
          )
        ) {
          success(
            result,
            `${prefix}: To date`
          );
        } else {
          note(
            result,
            `${prefix}: Confirm To date`
          );
        }
      } else {
        note(
          result,
          `${prefix}: To date missing in saved profile`
        );
      }
    }

    // EDUCATION

    for (
      const [index, school]
      of schools.entries()
    ) {
      const prefix =
        `Education ${index + 1}`;

      const root = section(prefix);

      if (!root) {
        note(
          result,
          `${prefix}: Section not found`
        );
        continue;
      }

      await write(
        root,
        "Overall Result (GPA)",
        school.gpa,
        result,
        prefix
      );

      const dates = datesOf(school);

      const first =
        school.startDate ||
        dates.start;

      const last =
        school.endDate ||
        dates.end;

      // FIRST YEAR ATTENDED
      if (yearOf(first)) {
        if (
          await setSchoolYear(
            root,
            "firstYearAttended",
            first
          )
        ) {
          success(
            result,
            `${prefix}: First year attended`
          );
        } else {
          note(
            result,
            `${prefix}: Confirm first year attended`
          );
        }
      } else {
        note(
          result,
          `${prefix}: First year missing in saved profile`
        );
      }

      // LAST YEAR ATTENDED
      if (yearOf(last)) {
        if (
          await setSchoolYear(
            root,
            "lastYearAttended",
            last
          )
        ) {
          success(
            result,
            `${prefix}: Last year attended`
          );
        } else {
          note(
            result,
            `${prefix}: Confirm last year attended`
          );
        }
      } else {
        note(
          result,
          `${prefix}: Last year missing in saved profile`
        );
      }

      // UNIVERSITY
      if (school.school) {
        if (
          await fillSchool(
            root,
            school.school
          )
        ) {
          success(
            result,
            `${prefix}: School`
          );
        } else {
          note(
            result,
            `${prefix}: Confirm school selection`
          );
        }
      }

      // DEGREE
      if (school.degree) {
        if (
          await fillDegree(
            root,
            school.degree
          )
        ) {
          success(
            result,
            `${prefix}: Degree`
          );
        } else {
          note(
            result,
            `${prefix}: Confirm degree option`
          );
        }
      }
    }

    result.needsAttention = [
      ...new Set(
        result.needsAttention
      ),
    ];

    return result;
  }

  globalThis.offerlyWorkdayExperience = {
    fill,
  };
})();
