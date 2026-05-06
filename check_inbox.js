import readline from "readline";

const DOMAIN = "kilolabs.space";
const BASE_URL = "https://kilomail.vercel.app";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ADJS = [
  "swift",
  "quiet",
  "clever",
  "bright",
  "bold",
  "crisp",
  "sleek",
  "dark",
  "prime",
  "noble",
];
const NOUNS = [
  "fox",
  "wolf",
  "hawk",
  "bear",
  "lynx",
  "crane",
  "raven",
  "shark",
  "viper",
  "eagle",
];

function randomUser() {
  const a = ADJS[Math.floor(Math.random() * ADJS.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 900) + 100}`;
}

function extractVerificationCode(text, subject) {
  const subjectMatch =
    subject?.match(/^(\d{4,8})\b/) || subject?.match(/\b(\d{4,8})\b/);
  if (subjectMatch) return subjectMatch[1];

  const patterns = [
    /confirmation\s+code(?:\s+in\s+the\s+app)?[^\d]+(\d{4,8})/i,
    /(?:code|verification|otp|pin|confirmation|token)[^\d]*(\d{4,8})\b/i,
    /\b(\d{4,8})\b/,
  ];

  for (const pattern of patterns) {
    const match = text?.match(pattern);
    if (match?.[1]) return match[1];
    if (match?.[0] && pattern.source === "\\b(\\d{4,8})\\b") return match[0];
  }

  return null;
}

async function startInbox(username) {
  const email = `${username}@${DOMAIN}`;
  console.log(`\n📧 Inbox active: \x1b[36m${email}\x1b[0m`);
  console.log(`📡 Connecting to stream... (Ctrl+C to stop)\n`);

  const url = `${BASE_URL}/api/inbox/${encodeURIComponent(email)}/stream`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to connect: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let seenIds = new Set();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "connected") {
              console.log("✅ Connected to real-time stream.\n");
            } else if (data.type === "update") {
              const messages = data.messages || [];
              for (const msg of messages) {
                if (!seenIds.has(msg.id)) {
                  seenIds.add(msg.id);

                  console.log(
                    `\x1b[33m[${new Date(msg.receivedAt).toLocaleTimeString()}]\x1b[0m`,
                  );
                  console.log(`\x1b[1mFrom:\x1b[0m ${msg.from}`);
                  console.log(
                    `\x1b[1mSubject:\x1b[0m ${msg.subject || "(No Subject)"}`,
                  );

                  const code = extractVerificationCode(msg.text, msg.subject);
                  if (code) {
                    console.log(
                      `\x1b[42m\x1b[30m VERIFICATION CODE: ${code} \x1b[0m`,
                    );
                    console.log(
                      `\x1b[2m${msg.text?.slice(0, 100)}${msg.text?.length > 100 ? "..." : ""}\x1b[0m`,
                    );
                  } else {
                    console.log(
                      `\x1b[31m[No code detected]\x1b[0m Full message body:`,
                    );
                    console.log(`\x1b[32m${msg.text || "(Empty Body)"}\x1b[0m`);
                    if (msg.html && !msg.text) {
                      console.log(
                        `\x1b[34m(HTML content available in raw data)\x1b[0m`,
                      );
                    }
                  }

                  console.log("-".repeat(40));
                }
              }
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
    console.log("Retrying in 5 seconds...");
    setTimeout(() => startInbox(username), 5000);
  }
}

rl.question("Enter username (leave blank for random): ", (answer) => {
  const username = answer.trim() || randomUser();
  rl.close();
  startInbox(username);
});
