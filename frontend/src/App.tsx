import "./App.css";
import { useState } from "react";

function App() {
  return (
    <main className="min-h-screen flex justify-center px-6 pt-[14vh] pb-16">
      <div className="max-w-[620px] w-full space-y-7 text-[19.5px] leading-relaxed">
        <p>
          hey! i'm zeke. i'm 17, based in seattle, and a founding engineer at{" "}
          <A href="https://mediscan.ai">MediScan AI</A>.
        </p>

        <p>
          i am a full stack software engineer who loves tinkering and building
          new things :)
        </p>

        <p className="!mb-0">some things i've built:</p>

        <ul className="list-disc pl-6 space-y-1.5 !mt-2">
          <li>
            <A href="https://www.figma.com/community/plugin/1566412604365451941/buddaai-ai-design-partner">
              Budda AI
            </A>
            <span className="inline-block mx-[8px]">~</span>an agentic ai design
            tool for figma w/ their native tooling, got around 20 paying
            customers and learned a lot about designer workflows.
          </li>
          <li>
            <A href="https://sumanyai.com">Sumany AI</A>{" "}
            <span className="inline-block mx-[8px]">~</span>lets you summarize
            documents using open weight transformer models (before chatgpt in
            '22), my first project that i got paying users for.
          </li>
          <li>
            A few open source projects that i'm proud of
            <span className="inline-block mx-[8px]">~</span>
            <A href="https://github.com/zeke-john/codecall">codecall</A>,{" "}
            <A href="https://github.com/zeke-john/rune">rune</A>,{" "}
            <A href="https://github.com/zeke-john/awsm">awsm</A>,{" "}
            <A href="https://github.com/zeke-john/komplete">komplete</A>
          </li>
        </ul>

        <p>
          in my free time when im not coding, i love making beats on my mpc,
          messing around w/ linux, reading, and continuously learning!
        </p>

        <p>
          you can find me on <A href="https://github.com/zeke-john">github</A>,
          {"  "}
          <A href="https://x.com/zekejawn">(x) twitter</A>,{"  "}
          <A href="https://www.linkedin.com/in/zeke-john-131ba1351/">
            linkedin
          </A>
          , or via <EmailLink />.
        </p>
      </div>
    </main>
  );
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
      <button
        onClick={handleClick}
        className="underline underline-offset-[3px] decoration-black/40 hover:decoration-black transition-colors"
      >
        email
      </button>
      {copied && <span> (copied!)</span>}
    </span>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-[3px] decoration-black/40 hover:decoration-black transition-colors"
    >
      {children}
    </a>
  );
}

export default App;
