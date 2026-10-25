import "./App.css";
import { useEffect, useRef, useState } from "react";
import Meadow from "./meadow/Meadow";

// birthday: november 11, 2008. The age ticks over at local midnight.
function ageOn(today: Date) {
  const birthYear = 2008,
    birthMonth = 10,
    birthDay = 11; // months are 0-based
  const hadBirthday =
    today.getMonth() > birthMonth ||
    (today.getMonth() === birthMonth && today.getDate() >= birthDay);
  return today.getFullYear() - birthYear - (hadBirthday ? 0 : 1);
}

function App() {
  const age = ageOn(new Date());
  return (
    <div className="page">
      <Meadow />
      <main className="relative z-10 flex-1 flex items-center justify-center px-7 pt-10 pb-16 scene:px-6">
        <div className="max-w-[760px] w-full space-y-8 text-[24px] leading-relaxed">
          <h1>
            <span className="hl">
              hey! i'm zeke. i'm {age}, based in seattle, and a founding
              engineer at <A href="https://mediscan.ai">MediScan AI</A>.
            </span>
          </h1>

          <p>
            <span className="hl">
              i am a full stack software engineer who loves tinkering and
              building new things :)
            </span>
          </p>

          <p className="!mb-0">
            <span className="hl">some things i've built:</span>
          </p>

          <ul className="built space-y-2 !mt-2">
            <li>
              <Dot i={0} />
              <span className="hl">
                <A href="https://www.figma.com/community/plugin/1566412604365451941/buddaai-ai-design-partner">
                  Budda AI
                </A>
                <Sep />an agentic ai design tool for figma w/ their native
                tooling, got around 8 paying users and learned a lot about
                designer workflows.
              </span>
            </li>
            <li>
              <Dot i={1} />
              <span className="hl">
                <A href="https://sumanyai.com">Sumany AI</A>
                <Sep />lets you summarize documents using open weight
                transformer models (before chatgpt in '22), my first project
                that i got paying users for.
              </span>
            </li>
            <li>
              <Dot i={2} />
              <span className="hl">
                a few open source projects that i'm proud of
                <Sep />
                <A href="https://github.com/zeke-john/codecall">
                  codecall
                </A>, <A href="https://github.com/zeke-john/rune">rune</A>,{" "}
                <A href="https://github.com/zeke-john/awsm">awsm</A>,{" "}
                <A href="https://github.com/zeke-john/komplete">komplete</A>
              </span>
            </li>
          </ul>

          <p>
            <span className="hl">
              in my free time i also love making beats, watching the knicks, and
              learning about cool new tech.
            </span>
          </p>

          <p>
            <span className="hl">
              you can find me on{" "}
              <A href="https://github.com/zeke-john">github</A>,{"  "}
              <A href="https://x.com/zekejawn">x (twitter)</A>,{"  "}
              <A href="https://www.linkedin.com/in/zeke-john-131ba1351/">
                linkedin
              </A>
              , or via <EmailLink />.
            </span>
          </p>

          <p className="ps">
            <span className="hl">
              p.s. you can drag the <span className="by-day">sun</span>
              <span className="by-night">moon</span>.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

const EMAIL = "zekejohn118@gmail.com";

type CopyStatus = "idle" | "copied" | "error";

function EmailLink() {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const handleClick = async () => {
    window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopyStatus("copied");
    } catch {
      // Clipboard access can be unavailable or denied; show the address so it
      // can still be copied manually instead of reporting a false success.
      setCopyStatus("error");
    }
    resetTimer.current = window.setTimeout(() => setCopyStatus("idle"), 4000);
  };

  return (
    <span>
      <button
        type="button"
        onClick={handleClick}
        className="lnk"
        aria-label="Copy email address"
      >
        email
      </button>
      <span role="status" aria-live="polite" aria-atomic="true">
        {copyStatus === "copied" && " (copied!)"}
        {copyStatus === "error" && ` (copy failed: ${EMAIL})`}
      </span>
    </span>
  );
}

// List furniture, kept quiet so the project names lead: a small painted dot
// beside each item, out on the painting rather than on the paper, drawn three
// slightly different ways so they don't look stamped, and a tilde between a
// name and what it is.
const DOTS = [
  "M5.4.9C7.8.8 9.3 2.6 9 5 8.7 7.5 7.3 9.3 4.8 9.1 2.4 8.9.8 7.4 1 4.9c.2-2.3 2-3.9 4.4-4Z",
  "M4.6 1.3C6.9.6 9.4 2.3 9.1 4.7 8.8 7 7.5 9.4 5 9 2.6 8.6.6 7.3 1 4.8c.3-2 1.7-3 3.6-3.5Z",
  "M5 .7c2.4.5 4.3 2.4 3.8 4.8-.4 2.1-2 3.2-4.2 3.5C2.3 9.3 1.1 7 .9 4.7.7 2.3 2.9.3 5 .7Z",
];
function Dot({ i }: { i: number }) {
  return (
    <svg className="dot" viewBox="0 0 10 10" aria-hidden="true">
      <path d={DOTS[i % DOTS.length]} />
    </svg>
  );
}
function Sep() {
  return <span className="sep" aria-hidden="true">~</span>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="lnk">
      {children}
    </a>
  );
}

export default App;
