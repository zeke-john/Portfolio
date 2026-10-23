import "./App.css";
import { useEffect, useState } from "react";
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
  useSelectionFlag();
  return (
    <div className="page">
      <Meadow />
      <main className="relative z-10 shrink-0 flex justify-center px-7 pt-[18vh] pb-24 scene:px-6 scene:pt-[20vh]">
        <div className="max-w-[760px] w-full space-y-8 text-[24px] leading-relaxed">
          <p>
            <span className="hl">
              hey! i'm zeke. i'm {age}, based in seattle, and a founding
              engineer at <A href="https://mediscan.ai">MediScan AI</A>.
            </span>
          </p>

          <p>
            <span className="hl">
              i am a full stack software engineer who loves tinkering and
              building new things :)
            </span>
          </p>

          <p className="!mb-0">
            <span className="hl">some things i've built:</span>
          </p>

          <ul className="list-disc pl-6 space-y-1.5 !mt-2">
            <li>
              <span className="hl">
                <A href="https://www.figma.com/community/plugin/1566412604365451941/buddaai-ai-design-partner">
                  Budda AI
                </A>
                <span className="inline-block mx-[8px]">~</span>an agentic ai
                design tool for figma w/ their native tooling, got around 8
                paying users and learned a lot about designer workflows.
              </span>
            </li>
            <li>
              <span className="hl">
                <A href="https://sumanyai.com">Sumany AI</A>
                <span className="inline-block mx-[8px]">~</span>lets you
                summarize documents using open weight transformer models (before
                chatgpt in '22), my first project that i got paying users for.
              </span>
            </li>
            <li>
              <span className="hl">
                A few open source projects that i'm proud of
                <span className="inline-block mx-[8px]">~</span>
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
        </div>
      </main>
    </div>
  );
}

// Marks the page while any text is selected, so link hover effects can stand down.
function useSelectionFlag() {
  useEffect(() => {
    const update = () => {
      const sel = document.getSelection();
      document.documentElement.dataset.selecting =
        sel && !sel.isCollapsed ? "1" : "0";
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);
}

function EmailLink() {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText("zekejohn118@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span>
      <button onClick={handleClick} className="lnk">
        email
      </button>
      {copied && <span> (copied!)</span>}
    </span>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="lnk">
      {children}
    </a>
  );
}

export default App;
