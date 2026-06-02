// 랜딩(공개) — 미인증 진입점. 소개 → 회원가입/로그인 퍼널.
// 완전 개인화된 AI 코칭 포지셔닝. 제품과 동일한 oklch 토큰.
import logoMark from '../brand-assets/logo-mark.svg';
import { Icon } from '../ui/Icon';

interface Props {
  onLogin: () => void;
  onGetStarted: () => void;
}

const VALUE = [
  { cls: 't1', k: '01 · Track', h: '전부 모입니다', p: '프롬프트·Hook·세션·설정을 Hook 한 줄로 자동 수집. 흩어지던 AI 작업이 처음으로 한곳에 쌓입니다.' },
  { cls: 't2', k: '02 · Wikify', h: '자산이 됩니다', p: '흩어진 .md 문서를 에이전트가 기획자·개발자·사용자 3관점 위키로 자동 정리. 같은 설명을 두 번 하지 않습니다.' },
  { cls: 't3', k: '03 · Coach', h: '나를 끌어올립니다', p: '축적된 데이터로 협업 점수와 "다음 한 걸음"을 제안. 느낌이 아니라 데이터로 성장합니다.' },
];

const TEASER_TPL = [
  { t: '리팩토링 지시', tag: '개발', b: '[파일]의 [함수]를 단일 책임 원칙으로 분리해줘. 기존 동작은 테스트로 먼저 고정하고…' },
  { t: '버그 재현 우선', tag: '디버깅', b: '이 버그를 재현하는 실패 테스트를 먼저 작성하고, 그 다음 통과시키는 최소 수정을…' },
  { t: 'PR 리뷰 요청', tag: '협업', b: '아래 diff를 보안(OWASP)·엣지케이스·가독성 3관점으로 리뷰하고 우선순위로 정리해줘…' },
];

export function Landing({ onLogin, onGetStarted }: Props) {
  return (
    <div className="lp">
      {/* hero */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <nav className="lp-nav">
            <div className="lp-brand"><img src={logoMark} alt="" />Nova<span>.</span></div>
            <div className="lp-nav-actions">
              <button className="lp-btn lp-btn-ghost" onClick={onLogin} type="button">로그인</button>
              <button className="lp-btn lp-btn-primary" onClick={onGetStarted} type="button">무료로 시작</button>
            </div>
          </nav>

          <div className="lp-hero-grid">
            <div>
              <div className="lp-eyebrow">완전 개인화된 AI 코칭</div>
              <h1 className="lp-h1">AI와 일한 흔적을,<br/><span className="lp-grad">나를 키우는 데이터</span>로.</h1>
              <p className="lp-lead">
                프롬프트·Hook·작업 패턴을 자동으로 수집하고, 자산으로 바꾸고, 다음 한 걸음까지 코칭합니다.
                AI 협업 실력을 느낌이 아니라 <strong>데이터</strong>로 키우세요.
              </p>
              <div className="lp-cta">
                <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onGetStarted} type="button">무료로 시작하기</button>
                <button className="lp-btn lp-btn-ghost lp-btn-lg" onClick={onLogin} type="button">로그인</button>
              </div>
              <p className="lp-note">신용카드 없이 시작 · 키 없이 바로 쓰는 관리형 AI · 프롬프트 원본은 절대 공유되지 않습니다</p>
            </div>

            {/* coach card mock */}
            <div className="lp-mock">
              <div className="lp-mock-bar"><i></i><i></i><i></i><span className="lp-mock-url">nova / coach</span></div>
              <div className="lp-mock-body">
                <div className="lp-mock-score">
                  <div className="lp-mock-num">85<s>/100</s></div>
                  <div className="lp-mock-metrics">
                    <div className="lp-mock-metric">명확성 · 99<div className="lp-mock-meter"><b style={{ width: '99%' }} /></div></div>
                    <div className="lp-mock-metric">거버넌스 · 100<div className="lp-mock-meter"><b style={{ width: '100%' }} /></div></div>
                    <div className="lp-mock-metric">꾸준함 · 57<div className="lp-mock-meter"><b style={{ width: '57%', background: 'var(--warning)' }} /></div></div>
                  </div>
                </div>
                <div className="lp-mock-insight"><b>이번 주 개선 기회</b> — 반복 지시는 CLAUDE.md로 정형화하면 토큰을 아끼고 일관성이 올라갑니다.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* value chain */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-kicker">Track → Wikify → Coach</div>
          <h2 className="lp-h2">흩어지던 AI 작업이<br/>나를 키우는 사이클이 됩니다</h2>
          <div className="lp-grid3">
            {VALUE.map((v) => (
              <div className={`lp-card ${v.cls}`} key={v.k}>
                <div className="k">{v.k}</div>
                <h3>{v.h}</h3>
                <p>{v.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* premium teaser — prompt library */}
      <section className="lp-section lp-section-alt">
        <div className="lp-wrap">
          <div className="lp-teaser">
            <div>
              <span className="lp-chip">Pro · 프롬프트 라이브러리</span>
              <h3>내 프롬프트가 자산이 되고,<br/>모두의 자산이 됩니다.</h3>
              <p>
                동의한 사용자들의 프롬프트를 LLM이 <strong>주제별 템플릿</strong>으로 증류합니다.
                개인 원본은 절대 노출되지 않고(자동 마스킹), 일반화된 고품질 템플릿만 공유됩니다.
                Pro 구독자는 이 라이브러리를 열람하고 바로 복사해 씁니다.
              </p>
            </div>
            <div>
              {TEASER_TPL.map((t) => (
                <div className="lp-tpl" key={t.t}>
                  <div className="top"><span>{t.t}</span><span className="tag">{t.tag}</span></div>
                  <div className="bd">{t.b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-kicker">Pricing</div>
          <h2 className="lp-h2">필요한 만큼만</h2>
          <p className="lp-sub">키 없이 바로 쓰는 관리형 AI 제공(플랜별 월 사용량 한도). 본인 키(BYOK)를 등록하면 한도 없이 본인 계정으로 직접 청구됩니다.</p>
          <div className="lp-prices">
            <div className="lp-price-card">
              <div className="lp-price-name">Free</div>
              <div className="lp-price">$0</div>
              <ul className="lp-feat">
                <li><Icon name="check" size={15} />내 AI 활동 자동 수집 (Track)</li>
                <li><Icon name="check" size={15} />협업 점수 + 개선 인사이트 (Coach)</li>
                <li><Icon name="check" size={15} />프로젝트 위키 자동 생성 (Wikify)</li>
              </ul>
              <button className="lp-btn lp-btn-ghost" onClick={onGetStarted} type="button" style={{ justifyContent: 'center' }}>무료로 시작</button>
            </div>
            <div className="lp-price-card pro">
              <span className="lp-price-badge">추천</span>
              <div className="lp-price-name">Pro</div>
              <div className="lp-price">$19<s> /월</s></div>
              <ul className="lp-feat">
                <li><Icon name="check" size={15} />Free의 모든 기능</li>
                <li><Icon name="check" size={15} />프롬프트 라이브러리 — 주제별 템플릿 열람·복사</li>
                <li><Icon name="check" size={15} />공유 풀 기여(옵트인) + 증류 결과 활용</li>
                <li><Icon name="check" size={15} />무제한 코치 브리핑</li>
              </ul>
              <button className="lp-btn lp-btn-primary" onClick={onGetStarted} type="button" style={{ justifyContent: 'center' }}>Pro로 시작</button>
            </div>
          </div>
        </div>
      </section>

      {/* footer cta */}
      <section className="lp-foot">
        <div className="lp-wrap">
          <h2>AI 협업, <span className="lp-grad">데이터로 키울</span> 시간입니다.</h2>
          <p>지금 가입하고, 첫 협업 점수를 확인하세요.</p>
          <div className="lp-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onGetStarted} type="button">무료로 시작하기</button>
          </div>
        </div>
      </section>
      <div className="lp-copyright">Nova · AI 협업 학습 대시보드 · Built in public</div>
    </div>
  );
}
