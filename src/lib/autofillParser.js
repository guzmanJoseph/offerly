
const clean = (value) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE =
  /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|" +
  "May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|" +
  "Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

const DATE_RE = new RegExp(
  `(?:${MONTH}\\.?\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4})` +
  `\\s*[-–—]\\s*` +
  `(?:Present|Current|Now|${MONTH}\\.?\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4})`,
  "i"
);

const HEADINGS = [
  "education", "experience", "work experience",
  "professional experience", "employment",
  "employment history", "work history",
  "projects", "technical projects", "personal projects",
  "software projects", "selected projects",
  "skills", "technical skills", "certifications",
  "awards", "activities", "leadership",
  "volunteer experience", "summary",
  "professional summary", "profile",
  "additional information", "interests"
];

function heading(line) {
  return clean(line).toLowerCase()
    .replace(/[:\-–—]+$/, "").trim();
}

function linesOf(text) {
  return text.split(/\r?\n/).map(clean).filter(Boolean);
}

function getSection(text, names) {
  const lines = linesOf(text);
  const start = lines.findIndex(line =>
    names.includes(heading(line))
  );
  if (start < 0) return [];

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (HEADINGS.includes(heading(lines[i]))) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function isBullet(line) {
  return /^[•●▪◦*]\s*|^[-–]\s+(?!\d)/.test(line);
}

function formatLine(line) {
  return isBullet(line)
    ? `• ${line.replace(/^[•●▪◦*]\s*|^[-–]\s+(?!\d)/, "")}`
    : line;
}

function contactMatch(text, parsedValue, pattern) {
  return clean(parsedValue).match(pattern)?.[0] ||
    linesOf(text).slice(0, 15).join(" ").match(pattern)?.[0] ||
    "";
}

// Preserve line breaks when extracting PDF text.
export async function readResume(file) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Maximum resume size is 5 MB.");
  }

  const extension = file.name.split(".").pop().toLowerCase();

  if (extension === "txt") {
    return file.text();
  }

  if (extension === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer()
    });
    return result.value;
  }

  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import(
      "pdfjs-dist/build/pdf.worker.min.mjs?url"
    );
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer())
    }).promise;

    const pages = [];

    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();

      const lines = [];
      let current = [];
      let previousY = null;

      for (const item of content.items) {
        if (typeof item.str !== "string") continue;

        const y = item.transform?.[5];

        if (
          previousY !== null &&
          typeof y === "number" &&
          Math.abs(y - previousY) > 3
        ) {
          if (current.length) lines.push(current.join(" "));
          current = [];
        }

        if (item.str.trim()) current.push(item.str.trim());
        if (typeof y === "number") previousY = y;

        if (item.hasEOL) {
          if (current.length) lines.push(current.join(" "));
          current = [];
          previousY = null;
        }
      }

      if (current.length) lines.push(current.join(" "));
      pages.push(lines.join("\n"));
    }

    return pages.join("\n");
  }

  throw new Error("Please upload a PDF, DOCX or TXT file.");
}

function parseEducation(item) {
  const degreeText = clean(item.degree);
  const dateText = clean(item.date);
  const gpaText = clean(item.gpa);
  const combined = [degreeText, dateText, gpaText].join(" ");

  const gpa = combined.match(
    /\bGPA\s*:?\s*(\d(?:\.\d{1,3})?)(?:\s*\/\s*4(?:\.0)?)?/i
  )?.[1] || "";

  const degree = degreeText
    .split(/\s*\|\s*/)[0]
    .replace(/\bGPA\s*:?\s*\d(?:\.\d+)?(?:\s*\/\s*4(?:\.0)?)?/i, "")
    .replace(DATE_RE, "")
    .trim();

  const date = combined.match(DATE_RE)?.[0] ||
    (!/GPA/i.test(dateText) && dateText !== degreeText
      ? dateText
      : "");

  return {
    school: clean(item.school),
    degree,
    date,
    gpa: gpa || (/^\d(?:\.\d+)?$/.test(gpaText) ? gpaText : "")
  };
}

function fallbackExperience(item) {
  const title = clean(item.jobTitle);
  const date = clean(item.date);

  return {
    company: clean(item.company),
    jobTitle: clean(title.replace(DATE_RE, "").replace(/[|,–—-]\s*$/, "")),
    date: title.match(DATE_RE)?.[0] ||
      date.match(DATE_RE)?.[0] ||
      (date === title ? "" : date),
    description: (item.descriptions || []).map(clean).join("\n")
  };
}

function parseExperience(text) {
  const lines = getSection(text, [
    "experience", "work experience",
    "professional experience", "employment",
    "employment history", "work history"
  ]);

  const headers = [];

  lines.forEach((line, index) => {
    if (isBullet(line)) return;

    const match = line.match(DATE_RE);
    if (!match) return;

    const title = clean(line.slice(0, match.index))
      .replace(/[|,–—-]\s*$/, "").trim();

    if (!title || title.length > 110) return;

    headers.push({ index, title, date: match[0] });
  });

  return headers.map((header, index) => {
    const next = headers[index + 1];
    const previous = headers[index - 1];
    const content = lines.slice(
      header.index + 1,
      next ? next.index : lines.length
    );

    let company = "";
    let description = [...content];
    const first = content[0] || "";

    // Employer often appears immediately under the job title.
    if (
      first &&
      !isBullet(first) &&
      !DATE_RE.test(first) &&
      first.length < 110
    ) {
      company = first;
      description = content.slice(1);
    }

    // Some formats place the employer above the job title.
    if (!company) {
      const above = lines[header.index - 1] || "";
      if (
        above &&
        previous?.index !== header.index - 1 &&
        !isBullet(above) &&
        !DATE_RE.test(above) &&
        above.length < 110
      ) {
        company = above;
      }
    }

    // Avoid merging the next employer with this description.
    if (next && description.length) {
      const last = description[description.length - 1];
      if (
        !isBullet(last) &&
        !DATE_RE.test(last) &&
        last.length < 110 &&
        !last.endsWith(".")
      ) {
        description.pop();
      }
    }

    return {
      company,
      jobTitle: header.title,
      date: header.date,
      description: description.map(formatLine).join("\n").trim()
    };
  });
}

function fallbackProject(item) {
  const parts = clean(item.name).split(/\s*\|\s*/);
  const descriptions = (item.descriptions || []).map(clean);

  if (parts.length > 1) {
    descriptions.unshift(`Technologies: ${parts.slice(1).join(" | ")}`);
  }

  return {
    name: parts[0] || "",
    date: clean(item.date).match(DATE_RE)?.[0] || "",
    description: descriptions.join("\n")
  };
}

function parseProjects(text) {
  const lines = getSection(text, [
    "projects", "technical projects",
    "personal projects", "software projects",
    "selected projects"
  ]);

  const headers = [];

  lines.forEach((line, index) => {
    if (isBullet(line)) return;

    const match = line.match(DATE_RE);
    if (!match) return;

    const before = clean(line.slice(0, match.index));
    if (!before || before.length > 180) return;

    const parts = before.split(/\s*\|\s*/);
    const name = clean(parts[0]);

    if (!name || name.length > 100) return;

    headers.push({
      index,
      name,
      date: match[0],
      technologies: parts.slice(1).join(" | ")
    });
  });

  return headers.map((header, index) => {
    const next = headers[index + 1];
    const details = lines.slice(
      header.index + 1,
      next ? next.index : lines.length
    );

    if (header.technologies) {
      details.unshift(`Technologies: ${header.technologies}`);
    }

    return {
      name: header.name,
      date: header.date,
      description: details.map(formatLine).join("\n").trim()
    };
  });
}

// Convert extracted text into the form's profile structure.
export async function parseAutofillResume(text) {
  const { parseResume } = await import("resume-parser-ats");
  const result = parseResume({ rawText: text });

  if (!result.success || !result.data) {
    throw new Error("Could not extract resume information.");
  }

  const data = result.data;
  const name = clean(data.profile?.name).split(/\s+/).filter(Boolean);

  const experience = parseExperience(text);
  const projects = parseProjects(text);

  const linkedin = text.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%.-]+\/?/i
  )?.[0] || "";

  const github = text.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i
  )?.[0] || "";

  return {
    firstName: name[0] || "",
    lastName: name.slice(1).join(" "),
    email: contactMatch(text, data.profile?.email, EMAIL_RE),
    phone: contactMatch(text, data.profile?.phone, PHONE_RE),
    location: clean(data.profile?.location),
    linkedin,
    github,
    education: (data.education || []).map(parseEducation),
    experience: experience.length
      ? experience
      : (data.experience || []).map(fallbackExperience),
    projects: projects.length
      ? projects
      : (data.projects || []).map(fallbackProject),
    skills: (data.skills || [])
      .flatMap(item => item.descriptions || [])
      .map(clean)
      .filter(Boolean)
      .join("\n")
  };
}
