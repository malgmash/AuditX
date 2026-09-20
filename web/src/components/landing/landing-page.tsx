import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, CheckCheck, Clock3, Copy, FileSearch, FileText, ScanLine } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { InvestigationDialog } from "./investigation-dialog";
import { Reveal } from "./reveal";
import styles from "./landing.module.css";

function Start({ light = false }: { light?: boolean }) {
  return (
    <Button asChild className={`${styles.button} ${light ? styles.lightButton : ""}`}>
      <Link href="/register">Get Started <ArrowRight aria-hidden="true" size={16} /></Link>
    </Button>
  );
}

const features = [
  { title: "Duplicate detection", icon: Copy, copy: "Find repeated and near-duplicate receipts or invoices, even when they appear weeks or months apart." },
  { title: "Behavioral anomalies", icon: ScanLine, copy: "Identify expenses or activity that significantly deviate from normal historical patterns." },
  { title: "AI investigation briefs", icon: FileSearch, copy: "Turn anomaly signals into clear explanations, investigation summaries, and recommended review steps." },
];

const steps = [
  { title: "Upload", copy: "Upload receipts, invoices, expenses, or timesheets." },
  { title: "Retrieve context", copy: "AuditX uses RAG to compare each record with relevant historical transactions and financial patterns." },
  { title: "Detect & investigate", copy: "Our detection engine finds anomalies, while AI explains what looks unusual and why." },
  { title: "Review", copy: "See the evidence and recommended next steps. Dismiss, resolve, or investigate further." },
];

function ReceiptPair({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? styles.compactReceipts : styles.receiptPair}>
      {["First submission", "63 days later"].map((label, index) => (
        <div key={label} className={styles.receipt}>
          <div className={styles.receiptIcon}><FileText size={16} strokeWidth={1.5} aria-hidden="true" /></div>
          <span>{label}</span>
          <strong>$742.00</strong>
          {!compact && <><p>Same merchant</p><div className={styles.receiptLines} aria-hidden="true"><i /><i /><i /></div><span className={styles.receiptFoot}>Receipt {index + 1}</span></>}
        </div>
      ))}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className={styles.landing}>
      <a href="#main" className={styles.skip}>Skip to content</a>
      <header className={`${styles.container} ${styles.nav}`}>
        <Logo href="/" />
        <nav aria-label="Main navigation"><a href="#how-it-works">How It Works</a><a href="#features">Features</a></nav>
        <div className={styles.navActions}><Link href="/login">Log In</Link><Start /></div>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={`${styles.heroCopy} ${styles.heroEnter}`}>
              <p className={styles.eyebrow}>Financial clarity for small businesses</p>
              <h1 id="hero-title">Find what<br />doesn’t add up.</h1>
              <p className={styles.lede}>AuditX helps small businesses detect suspicious expenses, duplicate receipts, unusual transactions, and financial anomalies before they become bigger losses.</p>
              <div className={styles.actions}><Start light /><a href="#how-it-works" className={styles.outlineButton}><ArrowDown size={14} aria-hidden="true" /> See how it works</a></div>
              <div className={styles.community}>
                <div className={styles.communityAvatars} aria-hidden="true">
                  <Image src="/landing/avatar-man.png" alt="" width={36} height={36} />
                  <Image src="/landing/avatar-woman.png" alt="" width={36} height={36} />
                  <Image src="/landing/avatar-man.png" alt="" width={36} height={36} />
                </div>
                <dl className={styles.communityStats}>
                  <div><dt>companies</dt><dd>10+</dd></div>
                  <div><dt>users</dt><dd>50+</dd></div>
                </dl>
              </div>
            </div>
            <div className={`${styles.heroVisual} ${styles.heroEnter} ${styles.heroEnterDelay}`}>
              <div className={styles.heroImageFrame}><Image src="/landing/owner-phone.png" alt="Small business owner checking an expense on his phone" width={1122} height={1402} sizes="(max-width: 700px) 85vw, 400px" priority className={styles.heroPhoto} /></div>
              <div className={styles.heroCase}>
                <div className={styles.miniHeader}><span>Possible duplicate</span><span className={styles.demoLabel}>Demo</span></div>
                <ReceiptPair compact />
                <div className={styles.similarity}><CheckCheck size={16} aria-hidden="true" /><span><strong>98%</strong> receipt similarity</span></div>
                <a href="#investigation" className={styles.miniButton}>View investigation <ArrowRight size={14} aria-hidden="true" /></a>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.dashboardPreview} aria-label="Illustrative dashboard preview">
          <Reveal className={`${styles.container} ${styles.previewContent}`}>
            <div className={styles.previewTitle}><FileSearch size={20} aria-hidden="true" /><div><strong>Your review workspace</strong><span>Illustrative product preview</span></div></div>
            <div className={styles.previewFinding}><span className={styles.statusDot} aria-hidden="true" /><span>Possible duplicate expense</span><span className={styles.badge}>High risk</span></div>
            <div className={styles.previewAmount}><strong>$742.00</strong><span>Potential exposure</span></div>
            <a href="#investigation" className={styles.previewLink} aria-label="Explore the example investigation"><ArrowRight size={20} /></a>
          </Reveal>
        </section>

        <section id="features" className={`${styles.container} ${styles.features}`} aria-labelledby="problem-title">
          <Reveal className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Why AuditX</p>
            <h2 id="problem-title">Small financial leaks<br />are easy to miss.</h2>
            <div className={styles.ledeStack}>
              <p className={styles.lede}>Duplicate receipts, inflated reimbursements, unusual invoices, and suspicious timesheets can disappear inside thousands of transactions.</p>
              <p className={styles.lede}>For small businesses without dedicated audit teams, reviewing every record manually is slow, difficult, and easy to get wrong.</p>
            </div>
          </Reveal>
          <div className={styles.featureTiles}>
            {features.map((feature, index) => (
              <Reveal key={feature.title} as="article" delayMs={index * 90}>
                <span className={styles.featureIcon}><feature.icon size={18} strokeWidth={1.5} aria-hidden="true" /></span>
                <h3>{feature.title}</h3><p>{feature.copy}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <hr className={styles.sectionRule} />

        <section id="how-it-works" className={`${styles.container} ${styles.workflow}`} aria-labelledby="workflow-title">
          <Reveal className={styles.workflowVisual}>
            <div className={styles.reviewImageFrame}><Image src="/landing/owner-review.png" alt="Business owner reviewing a receipt beside her laptop" width={1122} height={1402} sizes="(max-width: 800px) 384px, (max-width: 700px) 85vw, 424px" /></div>
            <div className={styles.reviewOverlay}>
              <div className={styles.miniHeader}><strong>Receipt comparison</strong><span className={styles.demoLabel}>Demo</span></div>
              <div className={styles.comparisonValue}><strong>98<span>%</span></strong><span>similarity<br />across two receipts</span></div>
              <div className={styles.comparisonTrack} aria-hidden="true"><span /></div>
              <div className={styles.comparisonFooter}><span>Submitted 63 days apart</span><CheckCheck size={16} aria-hidden="true" /></div>
            </div>
          </Reveal>
          <Reveal className={styles.workflowCopy} delayMs={100}>
            <p className={styles.eyebrow}>How AuditX works</p>
            <h2 id="workflow-title">From upload to investigation in four steps.</h2>
            <ol className={styles.steps}>
              {steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>{index + 1}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>)}
            </ol>
            <Start />
          </Reveal>
        </section>

        <hr className={styles.sectionRule} />

        <section id="investigation" className={`${styles.container} ${styles.investigation}`} aria-labelledby="investigation-title">
          <Reveal className={styles.investigationCopy}>
            <p className={styles.eyebrow}>A closer look</p>
            <h2 id="investigation-title">From anomaly to<br />investigation in seconds.</h2>
            <p className={styles.lede}>A possible duplicate expense. Two receipts submitted 63 days apart. AuditX brings the evidence together, so you can decide what comes next.</p>
            <div className={styles.exposure}><div><strong>$742<span>.00</span></strong><span>Potential exposure</span></div><span className={styles.badge}>High risk</span></div>
            <InvestigationDialog />
          </Reveal>
          <Reveal className={styles.evidenceVisual} delayMs={120}>
            <div className={styles.evidenceBackdrop} aria-hidden="true" />
            <div className={styles.evidenceLabel}><span className={styles.demoLabel}>Illustrative case</span><span>Possible duplicate expense</span></div>
            <ReceiptPair />
            <div className={styles.matchPill}><CheckCheck size={16} aria-hidden="true" />98% receipt match</div>
            <div className={styles.briefCard}><span className={styles.briefIcon}><FileSearch size={18} aria-hidden="true" /></span><div><h3>AI Investigator</h3><p>These expenses may represent repeated reimbursement of the same purchase. The receipts are highly similar despite being submitted on different dates.</p></div></div>
          </Reveal>
        </section>

        <section className={styles.context} aria-labelledby="context-title">
          <div className={`${styles.container} ${styles.contextGrid}`}>
            <Reveal className={styles.contextVisual}>
              <svg className={styles.contextPaths} viewBox="0 0 600 340" fill="none" aria-hidden="true"><path d="M-60 330C120 310 110 80 330 72" /><path d="M-60 365C120 345 165 180 415 165" /><path d="M-60 400C110 380 220 270 365 260" /></svg>
              <div className={styles.contextRecord}><span><FileText size={18} aria-hidden="true" /></span><div><strong>Historical receipts</strong><p>Find the same purchase</p></div><Copy size={16} aria-hidden="true" /></div>
              <div className={styles.contextRecord}><span><Clock3 size={18} aria-hidden="true" /></span><div><strong>Transaction history</strong><p>Understand the timing</p></div><FileSearch size={16} aria-hidden="true" /></div>
              <div className={styles.contextRecord}><span><ScanLine size={18} aria-hidden="true" /></span><div><strong>Financial patterns</strong><p>See what stands out</p></div><Check size={16} aria-hidden="true" /></div>
            </Reveal>
            <Reveal className={styles.contextCopy} delayMs={100}><p className={styles.eyebrow}>The context behind each flag</p><h2 id="context-title">One transaction may look harmless.<br />A pattern tells a different story.</h2><p className={styles.lede}>AuditX connects each record with relevant history, bringing related evidence into view. Less searching through transactions. More time to understand what deserves a closer look.</p><Start /></Reveal>
          </div>
        </section>

        <hr className={styles.sectionRule} />

        <Reveal as="section" className={`${styles.container} ${styles.finalCta}`} aria-labelledby="cta-title">
          <p className={styles.eyebrow}>Ready to investigate smarter?</p>
          <h2 id="cta-title">Investigate the transactions<br />that actually deserve attention.</h2>
          <p className={styles.lede}>AuditX finds unusual financial activity, connects the evidence, and helps finance teams understand what should be reviewed next.</p>
          <Start />
          <p className={styles.account}>Already have an account? <Link href="/login">Log In</Link></p>
        </Reveal>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}><Logo href="/" /><p>Detect. Connect. Explain. Investigate.</p><p>Financial clarity for<br />small businesses.</p></div>
            <nav aria-label="Explore AuditX"><h2>Explore</h2><a href="#how-it-works">How It Works</a><a href="#features">Features</a><a href="#investigation">Product demo</a></nav>
            <nav aria-label="Account"><h2>Get started</h2><Link href="/register">Create an account</Link><Link href="/login">Log In</Link></nav>
          </div>
          <div className={styles.footerBottom}><span>AuditX</span><span>Built for review. Designed for people.</span></div>
        </div>
      </footer>
    </div>
  );
}

