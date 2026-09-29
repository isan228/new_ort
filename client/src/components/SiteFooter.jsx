import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

const PRODUCT = ['exam', 'builder', 'review', 'cards', 'stats'];

export function Underlined({ children }) {
  return (
    <span className="cl-hl">
      {children}
      <img src="/cl/underline.svg" alt="" aria-hidden="true" className="cl-underline" />
    </span>
  );
}

export function CtaArrow() {
  return <img src="/cl/arrow.svg" alt="" aria-hidden="true" className="cl-arrow" />;
}

export default function SiteFooter({ cta = true }) {
  const { copy } = useLang();
  const { user } = useAuth();
  const land = copy.land;
  const cl = land.cl;
  const startTo = user ? '/app' : '/register';

  return (
    <footer className={`cl-footer ${cta ? '' : 'no-cta'}`}>
      {cta && (
        <div className="cl-container">
          <div className="cl-end">
            <h2>
              {cl.endH}
              {' '}
              <Underlined>{cl.endEm}</Underlined>
            </h2>
            <p>{cl.endP}</p>
            <Link className="cl-cta cl-cta-center" to={startTo}>
              <span>{cl.start}</span>
              <CtaArrow />
            </Link>
          </div>
        </div>
      )}
      <div className="cl-foot-sheet">
        <div className="cl-container">
          <div className="cl-foot-cols">
            <div>
              <p className="cl-foot-k">{cl.colProduct}</p>
              {PRODUCT.map((key) => <Link key={key} to={startTo}>{cl.chips[key]}</Link>)}
            </div>
            <div>
              <p className="cl-foot-k">{cl.colPlatform}</p>
              <Link to="/login">{cl.enter}</Link>
              <Link to="/register">{cl.register}</Link>
              <Link to="/pricing">{copy.nav.pricing}</Link>
            </div>
            <div>
              <p className="cl-foot-k">{cl.colInfo}</p>
              <a href="/#programma">{copy.nav.program}</a>
              <a href="/#kak">{copy.nav.how}</a>
              <a href="/#faq">{land.kickerFaq}</a>
            </div>
            <div>
              <p className="cl-foot-k">ORT.KG</p>
              <span>{land.footer}</span>
              <span>{land.notOfficial}</span>
            </div>
          </div>
          <div className="cl-foot-bottom">
            <span>{cl.rights}</span>
            <span className="cl-foot-logo">
              <img src="/logo-icon.png" alt="" />
              <b>ORT.KG</b>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
