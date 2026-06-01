import { motion } from 'framer-motion';
import { ArrowUpRight, TrendingUp, Phone, Star } from 'lucide-react';

const projects = [
  {
    name: 'Premium Roofing Co.',
    location: 'Amsterdam & Omgeving',
    image: '/images/portimage1.jpg',
    caseStudyUrl: 'https://rood-install-now.base44.app',
    challenge: 'Verouderde website, amper offerte-aanvragen via internet',
    results: [
      { icon: TrendingUp, stat: '+68%', label: 'Meer offerte-aanvragen' },
      { icon: Phone, stat: '+41%', label: 'Meer telefoontjes' },
      { icon: Star, stat: '#1', label: 'Google positie lokaal' },
    ],
    description:
      'Een complete website transformatie gericht op conversie. Nieuwe pagina-structuur, lead-formulieren en lokale SEO zorgden binnen 3 maanden voor meetbare resultaten.',
    tag: 'Websitedesign & SEO',
  },
  {
    name: 'Apex Roofing Solutions',
    location: 'Rotterdam & Den Haag',
    image: '/images/portimage2.jpg',
    caseStudyUrl: 'https://app.base44.com/apps/6a0cbadf8ee5744e2f9719f5/editor/preview',
    challenge: 'Geen mobiele optimalisatie, hoge bounce-rate',
    results: [
      { icon: TrendingUp, stat: '+52%', label: 'Meer aanvragen' },
      { icon: Phone, stat: '2,3s', label: 'Laadtijd mobiel' },
      { icon: Star, stat: '-64%', label: 'Lagere bounce-rate' },
    ],
    description:
      'Mobile-first herontwerp met razendsnelle performance. Elke pagina geoptimaliseerd voor bezoekers die via hun smartphone zoeken naar een dakdekker.',
    tag: 'Mobiele optimalisatie',
  },
  {
    name: 'North Holland Roof Works',
    location: 'Noord-Holland',
    image: '/images/portimage3.jpg',
    caseStudyUrl: 'https://smitten-home-flow.base44.app',
    challenge: 'Onzichtbaar in lokale Google-resultaten',
    results: [
      { icon: TrendingUp, stat: '+89%', label: 'Organisch verkeer' },
      { icon: Phone, stat: '+35%', label: 'Meer leads' },
      { icon: Star, stat: 'Top 3', label: 'Google Maps positie' },
    ],
    description:
      'Lokale SEO structuur, Google Business optimalisatie en stadspecifieke landingspagina\'s zetten dit bedrijf bovenaan in elke gemeente in Noord-Holland.',
    tag: 'Lokale SEO',
  },
];

export default function PortfolioSection() {
  return (
    <section id="portfolio" className="section-padding bg-[#F8FAFC] border-t border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20 rounded-full px-4 py-1.5 text-sm font-medium font-body mb-6">
            <span className="w-2 h-2 bg-[#F97316] rounded-full" />
            Case studies
          </div>
          <h2 className="font-heading font-bold text-[#0F172A] text-3xl sm:text-4xl lg:text-5xl leading-tight mb-5">
            Bewezen resultaten voor{' '}
            <span className="text-[#F97316]">dakdekkers</span>
          </h2>
          <p className="font-body text-[#0F172A]/60 text-lg leading-relaxed">
            Elke website die wij bouwen is gericht op één doel: meer opdrachten. Bekijk wat we hebben bereikt voor andere dakdekkersbedrijven.
          </p>
        </motion.div>

        {/* Portfolio Cards */}
        <div className="flex flex-col gap-8">
          {projects.map((project, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="bg-white rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-sm hover:shadow-xl transition-shadow duration-500 group"
            >
              <div className="grid lg:grid-cols-2">
                {/* Left: Content */}
                <div className="p-8 lg:p-10 flex flex-col justify-between gap-6">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <span className="inline-block bg-[#F97316]/10 text-[#F97316] text-xs font-medium font-body px-2.5 py-1 rounded-full mb-3">
                          {project.tag}
                        </span>
                        <h3 className="font-heading font-bold text-[#0F172A] text-2xl leading-tight">
                          {project.name}
                        </h3>
                        <p className="font-body text-sm text-[#0F172A]/50 mt-1">{project.location}</p>
                      </div>
                      <div className="w-10 h-10 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#0F172A] group-hover:border-[#0F172A] transition-colors duration-300">
                        <ArrowUpRight className="w-4 h-4 text-[#0F172A] group-hover:text-white transition-colors duration-300" />
                      </div>
                    </div>

                    <p className="font-body text-xs text-[#0F172A]/45 uppercase tracking-wider mb-1">
                      Uitdaging
                    </p>
                    <p className="font-body text-sm text-[#0F172A]/65 mb-5 leading-relaxed">
                      {project.challenge}
                    </p>
                    <p className="font-body text-sm text-[#0F172A]/65 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#E2E8F0]">
                    {project.results.map((result, j) => {
                      const Icon = result.icon;
                      return (
                        <div key={j} className="text-center">
                          <p className="font-heading font-bold text-xl text-[#F97316] leading-none mb-1">
                            {result.stat}
                          </p>
                          <p className="font-body text-xs text-[#0F172A]/50 leading-tight">
                            {result.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <a
                    href={project.caseStudyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-sm w-fit"
                    aria-label={`Bekijk case study: ${project.name}`}
                  >
                    Bekijk case study
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>

                {/* Right: Image */}
                <div className="relative h-64 lg:h-auto overflow-hidden">
                  <a
                    href={project.caseStudyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full"
                    aria-label={`Open case study: ${project.name}`}
                  >
                    <img
                      src={project.image}
                      alt={project.name}
                      className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-[1.06]"
                    />
                  </a>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent lg:from-transparent" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}