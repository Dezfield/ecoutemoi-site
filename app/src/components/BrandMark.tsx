export function BrandMark({ size = 40 }: { size?: number }) {
  return <img className="brand-mark" src="/brand-mark.svg" width={size} height={size} alt="" />;
}

export function Wordmark({ caption = true }: { caption?: boolean }) {
  return (
    <span className="wordmark">
      <BrandMark size={40} />
      <span className="wordmark-text">
        Écoute Moi
        {caption ? <span className="wordmark-caption">Личный кабинет</span> : null}
      </span>
    </span>
  );
}
