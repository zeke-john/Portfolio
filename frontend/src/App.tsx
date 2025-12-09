import "./App.css";
import {
  Github,
  Linkedin,
  Mail,
  MapPin,
  Building,
  Twitter,
} from "lucide-react";

function App() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
        <div className="flex flex-col justify-center space-y-6">
          <div className="w-full max-w-3xl rounded-lg overflow-hidden shadow-lg">
            <img
              src="/seattle.jpg"
              alt="Seattle skyline pixel art"
              className="w-full h-47.5 object-cover"
            />
          </div>

          <div className="space-y-4 text-left">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-left">
              <span className="wave-emoji">👋</span> hey! i'm zeke
            </h1>
            <div className="space-y-2.5">
              <p className="text-lg text-muted-foreground leading-relaxed text-left">
                i'm a full stack developer & full time tinkerer.
              </p>
              <div className="flex flex-col items-left gap-3 text-md text-muted-foreground">
                <span className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4" strokeWidth={2.25} />
                  Seattle, WA
                </span>
                <span className="flex items-center gap-1.5">
                  <Building className="w-4 h-4" strokeWidth={2.25} />
                  Founder Engineer @ MediScan AI
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
                href="https://x.com/mkdirDawg"
                icon={<Twitter className="w-5 h-5" />}
                label="Twitter"
              />
              <SocialLink
                href="mailto:zekejohn118@gmail.com"
                icon={<Mail className="w-5 h-5" />}
                label="Email"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

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

export default App;
