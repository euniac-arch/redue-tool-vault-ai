import { FreeAuditHero } from '@/components/FreeAuditHero';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { ContrastSimulator } from '@/components/landing/ContrastSimulator';
import { DiagnosisProofSection } from '@/components/landing/DiagnosisProofSection';
import { EngineCompatibility } from '@/components/landing/EngineCompatibility';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { PrescriptionModules } from '@/components/landing/PrescriptionModules';
import { PricingPackages } from '@/components/landing/PricingPackages';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { QueryReachSection } from '@/components/landing/QueryReachSection';
import { RoiValueSection } from '@/components/landing/RoiValueSection';
import { SovShareSection } from '@/components/landing/SovShareSection';
/**
 * Landing: glass hero → missed demand → proof → reach → SoV →
 * 5 prescriptions → before/after → ROI → pricing → FAQ → final CTA.
 */
export default function LandingPage() {
	return (
		<main className="landing-page pb-24">
			<FreeAuditHero />
			<div className="landing-container pb-4">
				<ProblemSection />
				<DiagnosisProofSection />
				<EngineCompatibility />
				<QueryReachSection />
				<SovShareSection />
				<PrescriptionModules />
				<ContrastSimulator />
				<RoiValueSection />
				<PricingPackages />
				<LandingFaq />
				<ClosingCta />
			</div>
		</main>
	);
}
