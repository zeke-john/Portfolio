import "./App.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import {
  Github,
  Linkedin,
  Mail,
  MapPin,
  Building,
  ExternalLink,
} from "lucide-react";

interface TiltState {
  rotateX: number;
  rotateY: number;
}

interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

interface ContributionWeek {
  days: ContributionDay[];
}

function App() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-40">
          <div className="flex flex-col justify-center space-y-6">
            <HeaderTiltCard />

            <div className="space-y-4 text-left">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-left">
                <span className="wave-emoji">👋</span> hey! i'm zeke
              </h1>
              <div className="space-y-2.5">
                <p className="text-lg text-muted-foreground leading-relaxed text-left">
                  i'm 17 and am a full time software engineer, i love building
                  and creating new things.
                </p>
                <div className="flex flex-col items-left gap-3 text-md text-muted-foreground">
                  <span className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4" strokeWidth={2.25} />
                    Seattle, WA
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building className="w-4 h-4" strokeWidth={2.25} />
                    Founding Engineer @ MediScan AI
                  </span>
                </div>
              </div>
              <div className="flex gap-2.5">
                <SocialLink
                  href="https://github.com/zeke-john"
                  icon={<Github className="w-5 h-5" />}
                  label="GitHub"
                />
                <SocialLink
                  href="https://www.linkedin.com/in/zeke-john-131ba1351/"
                  icon={<Linkedin className="w-5 h-5" />}
                  label="LinkedIn"
                />

                <SocialLink
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=zekejohn118@gmail.com"
                  icon={<Mail className="w-5 h-5" />}
                  label="Email"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center lg:items-end gap-4">
            <ProjectCard
              href="https://mediscan.ai"
              icon="/mediscan.svg"
              iconBgColor="#799ED9"
              iconZoom={122}
              title="MediScan AI"
              linkText="mediscan.ai"
              description="An AI-powered medical legal record analysis platform for physicians, doctors, and lawyers. We generate accurate medical record summaries & chronologies, and do automatic in-depth case review."
            />
            <ProjectCard
              href="https://www.figma.com/community/plugin/1566412604365451941/buddaai-ai-design-partner"
              icon="/budda.png"
              iconBgColor="#9B88B8"
              iconZoom={150}
              title="Budda AI"
              linkText="figma.com/BuddaAI"
              description="An AI Design Partner for Figma. Lets you create and modify your designs agentically, pulling context from your other designs and using your exact style."
            />
            <ProjectCard
              href="https://sumanyai.com"
              icon="/sumany.png"
              iconBgColor="#415873"
              iconZoom={115}
              title="Sumany AI"
              linkText="sumanyai.com"
              description="Built in 2022, A serverless SAAS platform that summarizes long documents and text using open source transformer models that I quantized for performance. One of the first projects I launched & got paying customers for."
            />
          </div>
        </div>
      </div>
      <footer className="w-full pb-5 flex justify-center text-muted-foreground leading-relaxed text-sm">
        © 2025 Zeke John. All rights reserved.
      </footer>
    </main>
  );
}

const maxTiltDegrees = 5;
const HeaderTiltCard = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [tilt, setTilt] = useState<TiltState>({ rotateX: 0, rotateY: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const element = cardRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const xRatio = x / rect.width;
    const yRatio = y / rect.height;

    const rotateY = (xRatio - 0.5) * maxTiltDegrees * 2;
    const rotateX = (0.5 - yRatio) * maxTiltDegrees * 2;

    setTilt({ rotateX, rotateY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  const handleClick = useCallback(() => {
    setIsFlipped((previous) => !previous);
  }, []);

  const tiltStyle: CSSProperties = {
    transform: `perspective(1200px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
  };

  return (
    <div className="w-full max-w-2xl">
      <div
        ref={cardRef}
        className="tilt-card"
        style={tiltStyle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className={`tilt-inner ${isFlipped ? "tilt-inner-flipped" : ""}`}>
          <div className="tilt-face tilt-face-front">
            <img
              src="/seattle.jpg"
              alt="Seattle skyline pixel art"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          <div className="tilt-face tilt-face-back">
            <GitHubHeatmap username="zeke-john" />
          </div>
        </div>
      </div>
    </div>
  );
};

const WEEKS_TO_SHOW = 18;
const LEVEL_COLORS = [
  "rgb(22, 27, 34)",
  "rgb(14, 68, 41)",
  "rgb(0, 109, 50)",
  "rgb(38, 166, 65)",
  "rgb(57, 211, 83)",
];

const GitHubHeatmap = ({ username }: { username: string }) => {
  const [weeks, setWeeks] = useState<ContributionWeek[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContributions = async () => {
      try {
        const response = await fetch(
          `https://github-contributions-api.jogruber.de/v4/${username}?y=last`
        );
        const data = await response.json();
        const contributions = data.contributions || [];

        const weekMap: Map<string, ContributionDay[]> = new Map();
        contributions.forEach(
          (day: { date: string; count: number; level: number }) => {
            const date = new Date(day.date);
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            const weekKey = startOfWeek.toISOString().split("T")[0];

            if (!weekMap.has(weekKey)) {
              weekMap.set(weekKey, []);
            }
            weekMap.get(weekKey)?.push(day);
          }
        );

        const sortedWeeks = Array.from(weekMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, days]) => ({
            days: days.sort(
              (a, b) => new Date(a.date).getDay() - new Date(b.date).getDay()
            ),
          }));

        setWeeks(sortedWeeks.slice(-WEEKS_TO_SHOW));
      } catch (error) {
        console.error("Failed to fetch contributions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContributions();
  }, [username]);

  if (loading) {
    return (
      <div className="w-full h-full bg-[rgb(13,17,23)] flex items-center justify-center">
        <div className="text-muted-foreground text-sm">loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[rgb(13,17,23)] p-3 flex items-center justify-center">
      <div
        className="grid gap-[3px] h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
          gridTemplateRows: "repeat(7, 1fr)",
        }}
      >
        {Array.from({ length: 7 }).map((_, dayIndex) =>
          weeks.map((week, weekIndex) => {
            const day = week.days.find(
              (d) => new Date(d.date).getDay() === dayIndex
            );
            const level = day?.level ?? 0;
            return (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className="rounded-sm w-full h-full"
                style={{ backgroundColor: LEVEL_COLORS[level] }}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

interface SocialLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

const SocialLink = ({ href, icon, label }: SocialLinkProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="p-2 rounded-lg border-2 border-muted-foreground/30 bg-transparent text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-all"
    aria-label={label}
  >
    {icon}
  </a>
);

interface ProjectCardProps {
  href: string;
  icon: string;
  iconBgColor?: string;
  iconZoom?: number;
  title: string;
  linkText: string;
  description: string;
}

const ProjectCard = ({
  href,
  icon,
  iconBgColor,
  iconZoom = 145,
  title,
  linkText,
  description,
}: ProjectCardProps) => {
  return (
    <div className="project-card">
      <div className="project-header-wrapper">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="project-header"
          aria-label={`${title} link`}
        >
          <div
            className="project-icon"
            style={iconBgColor ? { backgroundColor: iconBgColor } : undefined}
          >
            <img
              src={icon}
              alt={`${title} icon`}
              className="project-icon-img"
              style={{
                width: `${iconZoom}%`,
                height: `${iconZoom}%`,
              }}
            />
          </div>
          <div className="title-container">
            <div className="project-title">{title}</div>
            <div className="project-link">
              <ExternalLink className="w-4 h-4" strokeWidth={2} />
              {linkText}
            </div>
          </div>
        </a>
      </div>
      <div className="project-body">
        <div className="project-description">{description}</div>
      </div>
    </div>
  );
};

export default App;
