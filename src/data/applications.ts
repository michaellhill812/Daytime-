/**
 * Job-application material, imported as one pack.
 *
 * Twelve documents that arrived together as a folder of .docx files: a resume
 * and a cover letter tailored to each of five organizations, plus the two
 * interview study guides. They are here rather than in `seed.ts` because the
 * seed only ever runs for a workspace that has none — these had to reach a
 * live workspace that already holds real work. `applyImports` in
 * `store/storage.ts` is what puts them there, once.
 *
 * BODIES ARE VERBATIM. Extracted from the .docx paragraph by paragraph, with
 * list paragraphs prefixed "- " to keep the structure they were written with.
 * Nothing is summarised, tidied, reordered, or added. The whole point of the
 * Wall is being able to trust that what it shows is the actual document.
 *
 * Titles are the one thing written here rather than taken from the file: the
 * originals differ only by a company name buried mid-filename, which is
 * unreadable in a list. Each title now leads with the organization and names
 * the role it was written for.
 */
export interface ImportedDoc {
  id: string;
  title: string;
  body: string;
}

/**
 * Identifies this pack in `DaytimeState.imports`. Changing it would re-import
 * everything, including anything since deleted — so it never changes.
 */
export const APPLICATIONS_PACK_ID = 'applications-2026-08';

/**
 * Fixed, not `new Date()`: two devices importing at the same moment must
 * produce byte-identical documents, or the merge sees two edits of the same id
 * and one side's copy is discarded rather than recognised as the same thing.
 */
export const APPLICATIONS_ADDED_AT = '2026-08-21T12:00:00.000Z';

export const APPLICATION_DOCS: ImportedDoc[] = [
  {
    id: 'doc-app-activesite-resume',
    title: 'ActiveSite — Resume (Office Manager)',
    body: `MICHAEL HILL
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
SUMMARY
Operations and office-management professional who keeps a fast-moving office and its systems running, with hands-on ownership of records, vendors, facilities, and front-desk support, plus a habit of using AI to streamline administrative and data workflows. Organized, dependable, and comfortable with the practical, roll-up-your-sleeves work that keeps a workplace humming. Motivated to support high-stakes biosecurity work from behind the scenes.
SKILLS & TOOLS
Office & Facilities: Independent office operations, vendor and maintenance coordination, supply and purchasing, work-order tracking and quality control, front-desk and visitor point of contact
Applied AI & Automation: Custom GPT building, prompt engineering for data extraction and documentation, AI-assisted spreadsheet standardization and generation (ChatGPT, Claude)
Coordination & People: Event and logistics coordination, records management, scheduling, cross-team communication
Systems & Tools: Microsoft Excel and Google Sheets, PDF data extraction, CHAMP records system; quick to adopt tools such as Google Workspace, Slack, and Asana
Communication: Clear, concise writing across administrative, clinical, and public-facing contexts
EXPERIENCE
Administrative Assistant (Part-Time), Rockland Housing Authority, Rockland, MA — Feb 2026 to Mar 2026
Public housing agency
- Built a custom GPT to extract and categorize applicant data (priority level, eligibility status) from CHAMP PDF applications, enabling faster natural-language lookup than the standard CHAMP interface.
- Used AI to standardize inconsistently formatted spreadsheets across the applicant database and to generate new spreadsheets directly from raw data exports, cutting manual formatting time.
- Ran day-to-day office operations independently: processed housing applications for accuracy and completeness, screened applicants against program requirements, and served as the front-desk point of contact by phone and in person.
- Managed filing and records for residents and applicants, and catalogued and quality-checked work orders to keep maintenance moving on time.
Behavioral Therapist, Autism Learning Partners, Norwell, MA — Jan 2025 to Jun 2025
Applied behavior analysis (ABA) provider
- Delivered ABA therapy under BCBA-designed plans, implementing intervention strategies and tracking progress against defined targets.
- Wrote clinical session notes documenting behavior data and outcomes in the format and register expected by supervising BCBAs.
- Used AI to refine the tone and consistency of repetitive clinical documentation without altering the factual record.
Early Education Teacher, Cherubs Child Development Center / Bright Horizons, Hingham, MA — 2023 to 2024
Licensed childcare centers
- Produced a high volume of clear, audience-specific parent reports on child development, and used AI to tighten tone and cut time on recurring writing while keeping accuracy.
- Maintained safe, structured environments for children from infant through age five, accommodating individual needs including allergies and disabilities.
- Communicated proactively with families and coordinated with co-teachers as children's needs changed.
Grocery Runner, Roche Bros, Marshfield, MA — 2022 to 2023
Regional grocer
- Fulfilled customer orders through a fulfillment app, handling substitutions, customer communication, and age-verification compliance.
Tennis Instructor and Camp Counselor, Cohasset Recreation Department, Cohasset, MA — 2015 to 2019
Municipal recreation program
- Coordinated logistics for a multi-staff youth program serving up to 50 children daily (ages 6 to 14), managing scheduling, attendance, emergency contacts, and equipment.
- Kept the program running day to day and stepped in on whatever needed handling, from records to on-the-ground problem solving.
EDUCATION
Liberal Studies coursework, University of Massachusetts Boston (one semester completed).
High School Diploma, Cohasset High School, Cohasset, MA (2019).`,
  },
  {
    id: 'doc-app-activesite-letter',
    title: 'ActiveSite — Cover Letter (Office Manager)',
    body: `Michael Hill
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
[Date]
Hiring Team
ActiveSite
Cambridge, MA
Dear Hiring Team,
I am writing to apply for the Office Manager role at ActiveSite. Keeping an office and its systems running so a team can focus on hard, important work is what I do well, and I would find it meaningful to do that in service of protecting people from catastrophic biological risks.
I have owned the practical side of an office before. At the Rockland Housing Authority I handled records, work orders, quality control, screening, and front-desk service independently, and at the Cohasset Recreation Department I coordinated vendors, equipment, scheduling, and logistics for a multi-staff program serving up to fifty children a day. I am organized and dependable, and I am comfortable with the hands-on, roll-up-your-sleeves work that keeps a place running, from calling a vendor to fixing a stuck process to making sure the space is ready.
I also bring a habit most office managers do not. I use AI to streamline the administrative and data work. At Rockland I built a custom GPT to extract and categorize applicant data from CHAMP PDFs so it could be searched in plain language, and I used AI to standardize messy spreadsheets and generate new ones from raw data. For a fast-moving office, that means I do not just keep things running, I look for the friction and build a simpler way through it. I am a clear, concise communicator as well, which helps in a busy shared space.
I understand this is a role you want filled quickly, and I am ready to move. I would welcome the chance to show how I would take ownership of your office from day one. Thank you for your consideration.
Sincerely,
Michael Hill`,
  },
  {
    id: 'doc-app-astralis-resume',
    title: 'Astralis — Resume (Operations Associate)',
    body: `MICHAEL HILL
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
SUMMARY
Remote-first operations generalist who keeps a distributed team's tools, communication, and events running, and who improves the systems underneath them, with hands-on experience using AI to streamline administrative and data work. Comfortable owning the virtual office, coordinating logistics for in-person gatherings and fundraising events, and turning a clunky process into a repeatable one. Self-directed, dependable, and low-ego, and glad to be the person who makes everyone else's work easier.
SKILLS & TOOLS
Remote & Systems Operations: Managing shared workspaces and communication channels (Google Workspace, Slack), process documentation and improvement, records management, applicant and data screening
Applied AI & Automation: Custom GPT building, prompt engineering for documentation and data extraction, AI-assisted spreadsheet standardization and generation (ChatGPT, Claude)
Coordination & Events: Event and logistics coordination, scheduling and travel support, vendor coordination, cross-team communication
Communication: Clear, concise writing across administrative, clinical, and public-facing contexts; tone and clarity editing
EXPERIENCE
Administrative Assistant (Part-Time), Rockland Housing Authority, Rockland, MA — Feb 2026 to Mar 2026
Public housing agency
- Built a custom GPT to extract and categorize applicant data (priority level, eligibility status) from CHAMP PDF applications, enabling faster natural-language lookup than the standard CHAMP interface.
- Used AI to standardize inconsistently formatted spreadsheets across the applicant database and to generate new spreadsheets directly from raw data exports, cutting manual formatting time.
- Ran day-to-day office operations independently: processed housing applications for accuracy and completeness, screened applicants against program requirements, and served as the front-desk point of contact by phone and in person.
- Managed filing and records for residents and applicants, and catalogued and quality-checked work orders to keep maintenance moving on time.
Behavioral Therapist, Autism Learning Partners, Norwell, MA — Jan 2025 to Jun 2025
Applied behavior analysis (ABA) provider
- Delivered ABA therapy under BCBA-designed plans, implementing intervention strategies and tracking progress against defined targets.
- Wrote clinical session notes documenting behavior data and outcomes in the format and register expected by supervising BCBAs.
- Used AI to refine the tone and consistency of repetitive clinical documentation without altering the factual record.
Early Education Teacher, Cherubs Child Development Center / Bright Horizons, Hingham, MA — 2023 to 2024
Licensed childcare centers
- Produced a high volume of clear, audience-specific parent reports on child development, and used AI to tighten tone and cut time on recurring writing while keeping accuracy.
- Maintained safe, structured environments for children from infant through age five, accommodating individual needs including allergies and disabilities.
- Communicated proactively with families and coordinated with co-teachers as children's needs changed.
Grocery Runner, Roche Bros, Marshfield, MA — 2022 to 2023
Regional grocer
- Fulfilled customer orders through a fulfillment app, handling substitutions, customer communication, and age-verification compliance.
Tennis Instructor and Camp Counselor, Cohasset Recreation Department, Cohasset, MA — 2015 to 2019
Municipal recreation program
- Coordinated logistics for a multi-staff youth program serving up to 50 children daily (ages 6 to 14), managing scheduling, attendance, emergency contacts, and equipment.
- Kept the program running day to day and stepped in on whatever needed handling, from records to on-the-ground problem solving.
EDUCATION
Liberal Studies coursework, University of Massachusetts Boston (one semester completed).
High School Diploma, Cohasset High School, Cohasset, MA (2019).`,
  },
  {
    id: 'doc-app-astralis-letter',
    title: 'Astralis — Cover Letter (Operations Associate)',
    body: `Michael Hill
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
[Date]
Hiring Team
Astralis Foundation
(Remote)
Dear Hiring Team,
I am applying for the Operations Associate role at the Astralis Foundation. A remote, generalist role where I would keep the team's tools, communication, and events running, and steadily improve the systems behind them, is a strong match for how I work and for what I am good at. That you are building toward becoming a leading AI safety funder makes it work I would be proud to support.
I like being the person who owns the operational side so everyone else can focus. At the Rockland Housing Authority I ran the office day to day on my own, handling applications, screening, records, and work orders and being the point of contact for anyone who walked in or called. At the Cohasset Recreation Department I coordinated the logistics of a multi-staff program serving up to fifty kids a day, from scheduling and equipment to on-the-ground problem solving. That same instinct, keeping things organized and nothing slipping, is what I would bring to managing your shared workspaces, coordinating event and travel logistics, and supporting your fundraising and grantmaking operations.
What I think I would add beyond the basics is a real habit of using AI to make operations better. At Rockland I built a custom GPT that pulled and categorized applicant data straight from CHAMP PDF files, so information could be found by asking a plain-language question instead of digging through the standard interface, and I used AI to clean up messy spreadsheets and generate new ones from raw exports. In a small, scaling team, that kind of system-building is exactly where an operations generalist can save everyone time.
I am also genuinely drawn to the environment you describe, kind, impact-focused, and low-ego. I do my best work as a dependable, self-directed teammate who cares about the mission and takes ownership without needing the spotlight. I would welcome the chance to talk about how I can help.
Sincerely,
Michael Hill`,
  },
  {
    id: 'doc-app-cbai-resume',
    title: 'CBAI — Resume (Operations Associate)',
    body: `MICHAEL HILL
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
SUMMARY
Operations and office-management professional who keeps day-to-day systems, spaces, and events running smoothly, with hands-on experience applying AI tools to streamline administrative and data workflows. Comfortable taking independent ownership of an office, coordinating logistics across a team, and turning messy processes into repeatable systems. A clear, concise communicator who brings a warm, dependable, low-ego presence, and a genuine interest in the responsible development of AI.
SKILLS & TOOLS
Office & Operations: Independent office management, event and logistics coordination, records and filing systems, vendor and maintenance coordination, applicant and data screening, front-desk and customer service
Applied AI & Automation: Custom GPT building, prompt engineering for documentation and data extraction, AI-assisted spreadsheet standardization and generation (ChatGPT, Claude)
Systems & Tools: Microsoft Excel, PDF data extraction, CHAMP records system; quick to adopt new workplace and collaboration tools such as Google Workspace and Slack
Communication: Audience-adapted writing, clear and concise email, tone and clarity editing, cross-team coordination
EXPERIENCE
Administrative Assistant (Part-Time), Rockland Housing Authority, Rockland, MA — Feb 2026 to Mar 2026
Public housing agency
- Built a custom GPT to extract and categorize applicant data (priority level, eligibility status) from CHAMP PDF applications, enabling faster natural-language lookup than the standard CHAMP interface.
- Used AI to standardize inconsistently formatted spreadsheets across the applicant database and to generate new spreadsheets directly from raw data exports, cutting manual formatting time.
- Ran day-to-day office operations independently: processed housing applications for accuracy and completeness, screened applicants against program requirements, and served as the front-desk point of contact by phone and in person.
- Managed filing and records for residents and applicants, and catalogued and quality-checked work orders to keep maintenance moving on time.
Behavioral Therapist, Autism Learning Partners, Norwell, MA — Jan 2025 to Jun 2025
Applied behavior analysis (ABA) provider
- Delivered ABA therapy under BCBA-designed plans, implementing intervention strategies and tracking progress against defined targets.
- Wrote clinical session notes documenting behavior data and outcomes in the format and register expected by supervising BCBAs.
- Used AI to refine the tone and consistency of repetitive clinical documentation without altering the factual record.
Early Education Teacher, Cherubs Child Development Center / Bright Horizons, Hingham, MA — 2023 to 2024
Licensed childcare centers
- Produced a high volume of clear, audience-specific parent reports on child development, and used AI to tighten tone and cut time on recurring writing while keeping accuracy.
- Maintained safe, structured environments for children from infant through age five, accommodating individual needs including allergies and disabilities.
- Communicated proactively with families and coordinated with co-teachers as children's needs changed.
Grocery Runner, Roche Bros, Marshfield, MA — 2022 to 2023
Regional grocer
- Fulfilled customer orders through a fulfillment app, handling substitutions, customer communication, and age-verification compliance.
Tennis Instructor and Camp Counselor, Cohasset Recreation Department, Cohasset, MA — 2015 to 2019
Municipal recreation program
- Coordinated logistics for a multi-staff youth program serving up to 50 children daily (ages 6 to 14), managing scheduling, attendance, emergency contacts, and equipment.
- Kept the program running day to day and stepped in on whatever needed handling, from records to on-the-ground problem solving.
EDUCATION
Liberal Studies coursework, University of Massachusetts Boston (one semester completed).
High School Diploma, Cohasset High School, Cohasset, MA (2019).`,
  },
  {
    id: 'doc-app-cbai-letter',
    title: 'CBAI — Cover Letter (Operations Associate)',
    body: `Michael Hill
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
[Date]
Hiring Team
Cambridge Boston Alignment Initiative
Harvard Square, Cambridge, MA
Dear Hiring Team,
I am applying for the Operations Associate role at the Cambridge Boston Alignment Initiative. The mix of day-to-day office management, event coordination, and building out the internal systems that keep a growing team running is exactly the kind of behind-the-scenes work I do well, and I would be glad to do it for an organization focused on making the transition to advanced AI a safe one.
In my most recent role at the Rockland Housing Authority, I ran the office day to day on my own: processing applications, screening applicants, keeping records and work orders organized, and being the person people came to when something needed handling. Before that, I coordinated the logistics of a multi-staff youth program at the Cohasset Recreation Department, managing scheduling, attendance, equipment, and up to fifty kids a day. I like being the person who keeps the space and the systems working so everyone else can focus on the mission.
What I think sets me apart for this role is how I use AI to make operations better. At Rockland I built a custom GPT that pulled and categorized applicant data straight from CHAMP PDF files, so information could be found by asking a question in plain language instead of digging through the standard interface, and I used AI to clean up inconsistent spreadsheets and generate new ones from raw exports. That instinct for turning a clunky process into a repeatable system is exactly what your description means by maintaining and enhancing internal tools, and I would bring the same approach to learning your CRM and improving how things run as you scale.
I am also genuinely drawn to the kind of team you describe: young, mission-focused, and low-ego. I care about the responsible, practical side of AI, and I would value being part of a group doing serious work on it while I take ownership of the operational side. I would welcome the chance to talk about how I can help.
Sincerely,
Michael Hill`,
  },
  {
    id: 'doc-app-givewell-resume',
    title: 'GiveWell — Resume (Operations)',
    body: `MICHAEL HILL
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
SUMMARY
Careful, reliable operations generalist who supports the day-to-day work and the systems behind a mission-driven team, across administrative, people, and light-technical operations, with a habit of using AI to make that work faster and cleaner. Accurate and organized with records, documentation, scheduling, and process improvement, and a clear, concise writer. Motivated by helping a rigorous, high-impact organization run smoothly.
SKILLS & TOOLS
Operations & Administration: Independent office and records operations, applicant and data screening, work-order and quality control, scheduling and coordination
Applied AI & Automation: Custom GPT building, prompt engineering for documentation and data extraction, AI-assisted spreadsheet standardization and generation (ChatGPT, Claude)
People & Support: Onboarding and scheduling support, executive and team support, front-desk and visitor point of contact, cross-team communication
Data & Accuracy: Microsoft Excel and Google Sheets, PDF data extraction, CHAMP records system, careful attention to accuracy and completeness
Communication: Clear, concise writing across administrative, clinical, and public-facing contexts; tone and clarity editing
EXPERIENCE
Administrative Assistant (Part-Time), Rockland Housing Authority, Rockland, MA — Feb 2026 to Mar 2026
Public housing agency
- Built a custom GPT to extract and categorize applicant data (priority level, eligibility status) from CHAMP PDF applications, enabling faster natural-language lookup than the standard CHAMP interface.
- Used AI to standardize inconsistently formatted spreadsheets across the applicant database and to generate new spreadsheets directly from raw data exports, cutting manual formatting time.
- Ran day-to-day office operations independently: processed housing applications for accuracy and completeness, screened applicants against program requirements, and served as the front-desk point of contact by phone and in person.
- Managed filing and records for residents and applicants, and catalogued and quality-checked work orders to keep maintenance moving on time.
Behavioral Therapist, Autism Learning Partners, Norwell, MA — Jan 2025 to Jun 2025
Applied behavior analysis (ABA) provider
- Delivered ABA therapy under BCBA-designed plans, implementing intervention strategies and tracking progress against defined targets.
- Wrote clinical session notes documenting behavior data and outcomes in the format and register expected by supervising BCBAs.
- Used AI to refine the tone and consistency of repetitive clinical documentation without altering the factual record.
Early Education Teacher, Cherubs Child Development Center / Bright Horizons, Hingham, MA — 2023 to 2024
Licensed childcare centers
- Produced a high volume of clear, audience-specific parent reports on child development, and used AI to tighten tone and cut time on recurring writing while keeping accuracy.
- Maintained safe, structured environments for children from infant through age five, accommodating individual needs including allergies and disabilities.
- Communicated proactively with families and coordinated with co-teachers as children's needs changed.
Grocery Runner, Roche Bros, Marshfield, MA — 2022 to 2023
Regional grocer
- Fulfilled customer orders through a fulfillment app, handling substitutions, customer communication, and age-verification compliance.
Tennis Instructor and Camp Counselor, Cohasset Recreation Department, Cohasset, MA — 2015 to 2019
Municipal recreation program
- Coordinated logistics for a multi-staff youth program serving up to 50 children daily (ages 6 to 14), managing scheduling, attendance, emergency contacts, and equipment.
- Kept the program running day to day and stepped in on whatever needed handling, from records to on-the-ground problem solving.
EDUCATION
Liberal Studies coursework, University of Massachusetts Boston (one semester completed).
High School Diploma, Cohasset High School, Cohasset, MA (2019).`,
  },
  {
    id: 'doc-app-givewell-letter',
    title: 'GiveWell — Cover Letter (Operations)',
    body: `Michael Hill
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
[Date]
Hiring Team
GiveWell
(Remote)
Dear Hiring Team,
I am applying for your operations roles across grants, people, tech, and executive support. A careful, generalist operations job at an organization built on rigor and accuracy is a strong fit for how I work, and GiveWell's mission of directing money to the most cost-effective global health and poverty programs is one I would be glad to help run smoothly behind the scenes.
Accuracy and ownership are the core of how I operate. At the Rockland Housing Authority I ran the office day to day on my own: processing applications for accuracy and completeness, screening applicants against program requirements, keeping records and work orders organized, and being the reliable point of contact. In earlier roles I wrote clinical documentation to the exact standard supervising clinicians required, and produced a high volume of clear parent reports. I am organized, precise, and comfortable owning the administrative, people, and light-technical work that keeps a team moving.
I would also bring a practical AI-and-automation habit to the operations team. At Rockland I built a custom GPT that extracted and categorized applicant data from CHAMP PDF applications so it could be searched in plain language, and I used AI to standardize inconsistent spreadsheets and generate new ones directly from raw data. I look for the recurring friction in a workflow and build a cleaner path through it, which is exactly the kind of improvement a growing operations team benefits from.
I work well remotely, as a self-directed and dependable teammate, and I am based in Eastern time. I would welcome the chance to talk about where I could fit best across your operations roles. Thank you for considering my application.
Sincerely,
Michael Hill`,
  },
  {
    id: 'doc-app-securebio-resume',
    title: 'SecureBio — Resume (Operations Specialist)',
    body: `MICHAEL HILL
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
SUMMARY
Operations generalist who keeps offices, systems, and communications running smoothly and looks for ways to make them run better, with hands-on experience using AI tools to automate administrative and data workflows. Takes full, independent ownership of an office, coordinates logistics and vendors, and turns messy processes into repeatable systems. A clear, concise communicator who is proactive, dependable, and happy to roll up his sleeves for the essential behind-the-scenes work that lets a team do its best.
SKILLS & TOOLS
Office & Facilities: Independent office operations, vendor and maintenance coordination, supply and purchasing, work-order tracking and quality control, front-desk and visitor point of contact
Applied AI & Automation: Custom GPT building, prompt engineering for data extraction and documentation, AI-assisted spreadsheet standardization and generation (ChatGPT, Claude)
Coordination & People: Event and logistics coordination, records management, cross-team communication, onboarding and scheduling support
Systems & Tools: Microsoft Excel and Google Sheets, PDF data extraction, CHAMP records system; quick to adopt tools such as Google Workspace, Slack, and Asana
Communication: Clear, concise writing across administrative, clinical, and public-facing contexts; tone and clarity editing
EXPERIENCE
Administrative Assistant (Part-Time), Rockland Housing Authority, Rockland, MA — Feb 2026 to Mar 2026
Public housing agency
- Built a custom GPT to extract and categorize applicant data (priority level, eligibility status) from CHAMP PDF applications, enabling faster natural-language lookup than the standard CHAMP interface.
- Used AI to standardize inconsistently formatted spreadsheets across the applicant database and to generate new spreadsheets directly from raw data exports, cutting manual formatting time.
- Ran day-to-day office operations independently: processed housing applications for accuracy and completeness, screened applicants against program requirements, and served as the front-desk point of contact by phone and in person.
- Managed filing and records for residents and applicants, and catalogued and quality-checked work orders to keep maintenance moving on time.
Behavioral Therapist, Autism Learning Partners, Norwell, MA — Jan 2025 to Jun 2025
Applied behavior analysis (ABA) provider
- Delivered ABA therapy under BCBA-designed plans, implementing intervention strategies and tracking progress against defined targets.
- Wrote clinical session notes documenting behavior data and outcomes in the format and register expected by supervising BCBAs.
- Used AI to refine the tone and consistency of repetitive clinical documentation without altering the factual record.
Early Education Teacher, Cherubs Child Development Center / Bright Horizons, Hingham, MA — 2023 to 2024
Licensed childcare centers
- Produced a high volume of clear, audience-specific parent reports on child development, and used AI to tighten tone and cut time on recurring writing while keeping accuracy.
- Maintained safe, structured environments for children from infant through age five, accommodating individual needs including allergies and disabilities.
- Communicated proactively with families and coordinated with co-teachers as children's needs changed.
Grocery Runner, Roche Bros, Marshfield, MA — 2022 to 2023
Regional grocer
- Fulfilled customer orders through a fulfillment app, handling substitutions, customer communication, and age-verification compliance.
Tennis Instructor and Camp Counselor, Cohasset Recreation Department, Cohasset, MA — 2015 to 2019
Municipal recreation program
- Coordinated logistics for a multi-staff youth program serving up to 50 children daily (ages 6 to 14), managing scheduling, attendance, emergency contacts, and equipment.
- Kept the program running day to day and stepped in on whatever needed handling, from records to on-the-ground problem solving.
EDUCATION
Liberal Studies coursework, University of Massachusetts Boston (one semester completed).
High School Diploma, Cohasset High School, Cohasset, MA (2019).`,
  },
  {
    id: 'doc-app-securebio-letter',
    title: 'SecureBio — Cover Letter (Operations Specialist)',
    body: `Michael Hill
Hull, MA | 781-707-6763 | michaelhill812@gmail.com
[Date]
Hiring Team
SecureBio
One Broadway, 13th Floor, Cambridge, MA 02142
Dear Hiring Team,
I am writing to apply for the Operations Specialist/Associate role at SecureBio. The description of a connective person who keeps the office running, supports the team, and quietly makes complex systems feel effortless is a strong match for how I work, and I would be proud to do that work in service of protecting people from catastrophic biological risks.
You note a preference for candidates who use AI and automation to streamline operational work, and that is one of my strongest habits. At the Rockland Housing Authority I built a custom GPT that extracted and categorized applicant data from CHAMP PDF applications so it could be searched in plain language, and I used AI to standardize messy spreadsheets and generate new ones directly from raw data. In earlier roles I used the same tools to make clinical and parent-facing documentation more consistent without changing the facts. I look for the recurring friction in a workflow and build a simpler way through it.
Alongside that, I have run the practical, roll-up-your-sleeves side of an office. At Rockland I handled records, work orders, quality control, and front-desk service independently, and at the Cohasset Recreation Department I coordinated vendors, equipment, scheduling, and logistics for a multi-staff program serving up to fifty children a day. I am organized, dependable, and comfortable owning the essential work that does not always get noticed but keeps everything moving. I am also a clear, concise writer, which I know matters for a team that values getting to the point.
I understand this is a demanding role at a serious organization, and I am genuinely excited by that. I would welcome a work test or trial task as a chance to show how I would approach the job. Thank you for considering my application.
Sincerely,
Michael Hill`,
  },
  {
    id: 'doc-app-interview-guide',
    title: 'Interview Study Guide (general + CBAI, SecureBio)',
    body: `Interview Study Guide
Michael Hill. General first-tier prep, plus specifics for CBAI and SecureBio. Prepared with Incite Coaching.
This guide has two parts. The first is general preparation that works for any entry-level or first-tier interview. The second gets specific to the two roles you are sprinting on this week, CBAI and SecureBio. Read the general part once, then focus on whichever interview is next. The goal is not to memorize scripts. It is to walk in knowing your own stories cold so you can be calm, honest, and yourself.
Part 1. General interview preparation
Before the interview
- Research the organization for 20 to 30 minutes. Know what they do in one plain sentence, why it matters, and one recent thing they published or shipped. Write it down.
- Reread the job description and underline every responsibility. For each one, have a real example ready of something close you have done.
- Sort out logistics the day before. If it is in person, know the route and plan to arrive 10 minutes early. If it is virtual, test the camera, mic, and link, sit somewhere quiet with good light, and have your resume and notes nearby.
- Dress one notch above the team's everyday. For these startup and nonprofit offices, clean business casual is right.
- Bring or have open: your resume, a short list of your stories, and your questions for them.
Tell your story in a clear line
You are a career-changer who has landed on operations on purpose, because it uses your real strengths: keeping systems and spaces running, communicating clearly, and using AI to make work faster. Lead with that. You do not need to apologize for your path or your education. Say what you can do, back it with examples, and let your calm confidence carry it.
Your five stories to know cold:
- The AI win. Building the custom GPT to pull and categorize applicant data from CHAMP PDFs, and cleaning and generating spreadsheets with AI. Use this for initiative, problem solving, and improving a process.
- Running the office. Handling Rockland's records, work orders, screening, and front desk on your own. Use this for ownership and juggling many tasks.
- Logistics at scale. Coordinating a multi-staff program for up to 50 kids a day at Cohasset Rec. Use this for coordination, staying organized under pressure, and events.
- Writing to a standard. Clinical notes for BCBAs and parent reports, in exactly the format each audience needed. Use this for communication and attention to detail.
- Learning fast. Teaching yourself CHAMP, the ABA framework, and AI tools. Use this for adaptability and picking things up quickly.
Use the STAR method for any "tell me about a time" question
Situation, Task, Action, Result. Set the scene in a sentence, say what needed doing, spend most of your time on what you did, and finish with the outcome. Keep it to about a minute.
Handling the harder questions honestly
Your education and path. Do not over-explain. One calm sentence: you have built your skills through work and self-teaching, especially with AI tools, and you learn quickly and take ownership. Then pivot to an example. Watch your instinct to analyze it out loud. Short and steady beats thorough here.
Gaps or shorter roles. Be brief and forward-looking: you spent time finding the direction that actually fits, and you have landed on operations because it uses your strengths, and you are committed to it. Answer, then move forward.
Common questions, and how to answer them
Tell me about yourself. Approach: Give a 60 to 90 second arc: what you do now, one or two relevant highlights, and why you are excited about this role. Present, past, future. In his words: "I am an operations person who likes being the one who keeps an office and its systems running. Most recently I ran the day to day at a housing authority office, where I also built a custom AI tool to pull applicant data out of clunky PDFs so it could be searched in plain language. Before that I coordinated logistics for a fifty-kid recreation program. I am drawn to this role because it is exactly that kind of behind-the-scenes ownership, for a mission I actually care about."
Why this role, or why operations? Approach: Tie your strengths to the work and name a specific responsibility from their posting. In his words: "I am at my best when I am the person keeping things organized so everyone else can focus. This role is that, and I like that it also involves improving the systems over time, which is where I get to use AI to make the work faster."
Why us, or why this mission? Approach: Show you did the reading. One honest sentence on why the mission interests you, then connect it to wanting to enable that work operationally. Do not overclaim expertise.
What is your greatest strength? Approach: Pick the one that is both true and rare for the role: using AI to simplify operational work. In his words: "Turning a messy, repetitive process into a simple one, usually with AI. At the housing authority I built a custom GPT that categorized applicant data so we could just ask it questions instead of digging through files."
What is a weakness? Approach: Name a real one you actively manage. In his words: "I can spend too long trying to make something perfect. I have gotten better by asking what is actually good enough for the goal and time-boxing the task, which keeps me moving."
Tell me about a time you improved a process. Approach: Use the AI win in full STAR. This is your strongest story, so tell it well.
Tell me about a time you juggled a lot at once. Approach: Use running the Rockland office or the Cohasset program. Emphasize that nothing fell through the cracks and how you kept track.
Tell me about a difficult person or customer. Approach: Use front-desk service at the housing authority or families at the daycare. Show that you stayed warm and professional and solved the actual problem.
Tell me about a mistake. Approach: Pick a real, small one, own it plainly, and say what you changed.
Where do you see yourself, or why should we hire you? Approach: You want to grow into a strong operations professional, and you would bring dependable ownership plus an AI edge that most entry candidates do not have.
What are your salary expectations? Approach: Do a little research first. If they posted a range, say you are comfortable within their posted range. If not, give a reasonable band or say you are flexible and want to find a fair fit.
If nerves hit, use your reset
Before you walk in or log on, run your 60-second reset. Box breathe, in for four, hold for four, out for eight, a few rounds, and remind yourself this is a conversation, not a test. If a question rattles you, it is fine to pause, take a breath, and say "good question, let me think for a second." That reads as thoughtful, not slow.
Always have questions for them
- What does a great first ninety days look like in this role?
- What are the biggest operational challenges the team is dealing with right now?
- How does the team like to use tools and automation, and is there appetite for improving systems?
- What is the team and the office culture like day to day?
After the interview
Send a short thank-you email within a day. Three sentences: thank them, name one specific thing from the conversation you appreciated, and say you would welcome next steps. It is a small thing that a lot of people skip.
Part 2. CBAI (Cambridge Boston Alignment Initiative)
What they do, in plain terms
CBAI is a nonprofit that supports research and education aimed at making the shift to advanced AI safe and beneficial. A lot of their work runs through fellowship programs and student groups like MAIA, the MIT AI alignment group. The Operations Associate keeps their Harvard Square office and their events running and helps build the internal systems behind the programs.
What the role really is
- Day-to-day office management: maintenance, supplies, keeping the space working.
- Event logistics: making fellowship and team events run smoothly, on the ground.
- Internal systems: maintaining and improving tools like the CRM, task management, and how information is stored, so programs can scale.
- Working closely with young student organizers and the full-time team.
Your angle for CBAI
Lead with two things: you have independently run an office and coordinated real logistics, and you use AI to build and improve systems, which is exactly their "maintain and enhance internal tools" language. The technical bar is low and the pay is good for entry-level, so your job is simply to come across as dependable, organized, genuinely interested in the mission, and easy to work with.
On being a bit older than the student crowd. Treat it as an asset, not a worry. Their team skews young and student-driven. You are not competing to be the smartest researcher in the room. You are the steady, reliable person who takes ownership of operations so the young organizers can focus on the work.
Likely CBAI questions
Why are you interested in AI safety, or in CBAI specifically? Approach: Be honest and grounded. You are interested in the practical, responsible side of AI, you already use these tools hands-on, and you want to help a serious effort run well. In his words: "I care about AI being developed responsibly, and I actually use these tools every day to do real work, so it is not abstract to me. I am not here to be a researcher. I am here to make sure the operation behind the research runs smoothly, which is what I am good at."
How would you handle running events and the office at the same time? Approach: Use your Cohasset logistics story and your Rockland ownership. Show a system: lists, priorities, and staying ahead of what is coming.
Tell us about a system you built or improved. Approach: The CHAMP custom GPT and the spreadsheet work, told in STAR. Connect it directly to maintaining and improving their internal tools and CRM.
Smart questions to ask CBAI
- How do the office and the fellowship programs interact week to week?
- What internal systems are most in need of improvement right now?
- What does the team wish the last person in this role had done more of?
Part 3. SecureBio
What they do, in plain terms
SecureBio is a biosecurity nonprofit working to protect people from catastrophic biological risks, natural or engineered. Their approach is to delay, detect, and defend, through early-warning detection work and an AI-and-biotech-risk effort. Both programs are growing fast, which is why they are hiring on the operations side. The role is in person at their Kendall Square office in Cambridge.
What the role really is
- Office operations and facilities: vendors, workspaces, supplies, keeping the office running and improving it.
- Special projects: owning improvements like onboarding, shared spaces, and recurring workflows.
- People and culture: a warm, organized office, onboarding logistics, team events.
- Administrative and executive support: calendars, communications, travel, being the point of contact for visitors.
- Light IT and systems: SaaS accounts, tech inventory, documenting workflows.
- Purchasing and spend: buying for the team and tracking it, finding ways to save.
Their hiring process, so you are ready
They review on a rolling basis and want someone soon, so applying quickly matters. After the written application, strong candidates get a 30-minute work test, then possibly further interviews and paid trial tasks, plus reference and background checks. The work test is good news for you: it is a chance to show how you actually think about an operations problem, which plays to your strengths more than talking about yourself does. When it comes, treat it like a real task, keep your solution simple and organized, and show your reasoning.
Your angle for SecureBio
Their posting practically lists your strengths: a clear and concise communicator, proactive and improvement-oriented, highly organized, warm and professional, autonomous and dependable, technologically capable, and they explicitly prefer people who use AI to streamline operations. Mirror that language with real proof. Your AI-for-operations work is your single biggest differentiator here, so lead with it, then back it with your office-ownership and logistics stories.
On the experience bar. The Specialist level asks for a bachelor's or about two years in a similar role. You are on the early side, so do not pretend otherwise. Instead, make the case on substance: you have independently owned an office, you coordinated multi-year program logistics at Cohasset Rec, and you bring an AI-and-automation habit most candidates do not have. Let the work test carry the rest.
Likely SecureBio questions
Why operations, and why SecureBio? Approach: Honest interest in the mission plus genuine enthusiasm for the behind-the-scenes role. In his words: "I like being the person who makes complex things feel effortless for everyone else, and I would find it meaningful to do that for work this important. I am motivated by enabling a team, not by being in the spotlight."
Tell us about a time you used AI or automation to improve an operational workflow. Approach: This is your question. Tell the CHAMP custom GPT and spreadsheet story in full STAR, and be specific about the before and after.
Describe how you stay organized when a lot is coming at you. Approach: Rockland and Cohasset. Show your system for making sure nothing slips, and that you communicate priorities to others.
This role has some unglamorous, hands-on work. How do you feel about that? Approach: Welcome it plainly. In his words: "That is honestly the part I like. I do not need the work to be flashy. I get satisfaction from a space and a set of systems that just work, and I am glad to do the unglamorous parts that make that happen."
Smart questions to ask SecureBio
- As both programs grow, what operational challenges are you most focused on this year?
- What would make someone a standout in this role in the first six months?
- Where do you most want to see AI or automation applied to how the office runs?
One last thing. You belong in these rooms. You are not sneaking in. You bring real operations experience and a genuinely uncommon skill with AI, and you are applying for roles that are a fair match for where you are. Walk in steady, tell your true stories, and let them see the person who gets things running.`,
  },
  {
    id: 'doc-app-interview-addendum',
    title: 'Interview Study Guide — Addendum (Astralis, ActiveSite, GiveWell)',
    body: `Interview Study Guide, Addendum
Michael Hill. Role-specific prep for Astralis, ActiveSite, and GiveWell. Use with Part 1 of the main guide.
This adds three more organizations to your kit. The general preparation in Part 1 of the main study guide still applies to all of them: the same five stories, the STAR method, the honest scripts for the harder questions, and the reset for nerves. What follows is what makes each of these three specific.
Astralis Foundation (remote)
What they do, in plain terms
Astralis is a new foundation aiming to become a leading funder of AI safety work within a few years, supporting the people and organizations reducing risks from advanced AI. They are small and scaling, and they are building an operations team, so an operations generalist here gets to shape how things run.
What the role really is
- Owning the virtual office: keeping shared tools and communication channels like Google Workspace and Slack organized and working.
- Coordinating logistics for in-person team gatherings and fundraising or grantmaking events.
- Improving the systems the organization uses to operate, and generally solving whatever operational problems come up.
- Doing it remotely, which means being self-directed and dependable without someone over your shoulder.
Your angle for Astralis
This role rewards a generalist who takes ownership and improves systems, which is you. Lead with three things: you have run an office and coordinated real logistics independently, you use AI to make operations faster, and you are a self-directed remote worker who does not need to be managed closely. The culture they describe, kind and low-ego, is a genuine fit for how you work.
On working remotely. Expect at least one question about how you stay organized and motivated on your own. Have a concrete answer: your daily structure, how you track tasks so nothing slips, and how you communicate proactively so a remote team always knows where things stand.
Likely questions
How do you stay organized and productive working remotely? Approach: Give a real system, not a vibe. In his words: "I run a consistent daily structure and keep a running task list so nothing falls through. Working remotely, I over-communicate a little on purpose, so people always know what is done and what is next without having to ask."
Tell us about a system you built or improved. Approach: The CHAMP custom GPT and spreadsheet work in STAR. Tie it to improving the systems a small, scaling org runs on.
Why AI safety, or why Astralis? Approach: Honest and grounded. You use these tools hands-on, you care about them being developed responsibly, and you want to help a serious funder run well.
Smart questions to ask
- As the operations team is just forming, what would you most want this person to build or own first?
- How does the team communicate and stay connected as a remote group?
- What does a great first few months look like in this role?
ActiveSite
What they do, in plain terms
ActiveSite is a Cambridge biosecurity organization working on the science and infrastructure to guard against dangerous biological threats. Like the other biosecurity groups on your list, they do highly technical work and need dependable operations people to keep the office and the day-to-day running so the specialists can focus.
Heads-up. Their exact job posting was not fully readable when this was prepared, so before the interview, reread the live description and underline the specific duties and any tools they name. Match your examples to their words. Everything below is the safe, likely core of the role.
Your angle for ActiveSite
This is close to the SecureBio role, so the same playbook applies. Lead with hands-on office and facilities ownership, back it with your AI-for-operations habit, and show genuine, grounded interest in the mission. They want the office handled quickly and reliably, so come across as someone who will take ownership from day one and is happy with the practical, unglamorous work.
Likely questions
This role has a lot of hands-on, practical work. How do you feel about that? Approach: Welcome it. In his words: "That is the part I actually like. I get real satisfaction from a space and a set of systems that just work, and I am glad to handle the unglamorous things that make that happen."
Tell us about a time you owned an office or a space on your own. Approach: Rockland and Cohasset in STAR. Emphasize independence, reliability, and keeping many things moving at once.
How would you use technology to make the office run better? Approach: Your AI-for-operations story. Be concrete about the before and after.
Smart questions to ask
- What are the most pressing operational needs in the office right now?
- What would make the first ninety days a success in this role?
- How do the operations and the scientific teams work together day to day?
A possible foot in the door
There is also a part-time field sampler role in this world, collecting biological samples from the public for research. If the office role is competitive, that part-time role could be a lower-barrier way to get inside the organization, build a track record, and be first in line when operations roles open. Worth considering as a strategy, not a consolation.
GiveWell (remote)
What they do, in plain terms
GiveWell is a nonprofit that rigorously researches where charitable dollars do the most good, and directs hundreds of millions of dollars a year toward the most cost-effective global health and poverty programs. They are known for being careful, analytical, and transparent. The posting you are looking at is an umbrella application for operations roles across grants, people, tech, and executive support. It is remote, and they generally ask staff to work within about three hours of Pacific time, which Eastern time meets.
Your angle for GiveWell
GiveWell prizes accuracy, clear thinking, and reliability, so make those the spine of everything you say. Lead with careful, independent ownership of administrative and records work, back it with your AI-for-operations habit, and lean on your clear, concise writing, which an analytical organization values. Because it is an umbrella application, it also helps to say which kind of operations work fits you best. Based on your background, people operations, executive support, and light-tech or systems operations are your strongest angles.
Note on the listing. The description you originally wrote up (an AI hiring platform, visas, writing job descriptions) does not match this GiveWell posting, which is a general operations application. If there is a separate AI-hiring-platform company you meant, send that link and I will build a kit for it too. The materials here are aimed at the real GiveWell operations roles.
Likely questions
Why GiveWell, or why this kind of operations work? Approach: Connect their rigor and mission to how you work: careful, accurate, and reliable, and motivated by helping important work run smoothly. In his words: "I am careful and accurate by nature, and I like being the person who makes sure the details are right so the bigger work can be trusted. Doing that for an organization as rigorous as GiveWell, aimed at helping the most people possible, would mean a lot to me."
Which operations area fits you best, and why? Approach: Pick one or two honestly: people operations and executive support, or light-tech and systems operations. Tie each to a real example.
Tell us about a time accuracy really mattered. Approach: Use processing housing applications for accuracy and completeness at Rockland, or clinical documentation to a strict standard.
Tell us about improving a process with technology. Approach: The CHAMP custom GPT and spreadsheet work, in STAR.
Smart questions to ask
- Across the operations roles, where is the team's biggest need right now?
- What does GiveWell look for that makes someone thrive here specifically?
- How does the operations team support the research and grantmaking work?
Same reminder as the main guide. You belong in these rooms. You bring real operations experience and an uncommon skill with AI, and these are fair-match roles. Walk in steady, tell your true stories, and be the person who gets things running.`,
  },
];
