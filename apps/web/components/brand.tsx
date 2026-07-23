import type { JSX } from 'react';

export const TAGLINE = "It's not just a haircut, it's a lifestyle!";

/** The script tagline from the logo lockup. */
export const Tagline = ({ className = '' }: { className?: string }): JSX.Element => (
  <span className={`font-script ${className}`}>
    It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
  </span>
);

/** Full "lifestyle" lockup: Brewheat wordmark over the script tagline. */
export const LifestyleLockup = ({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'xl';
  className?: string;
}): JSX.Element => {
  const wordmark =
    size === 'xl' ? 'text-6xl sm:text-8xl' : size === 'md' ? 'text-4xl' : 'text-2xl';
  const script =
    size === 'xl' ? 'text-3xl sm:text-4xl' : size === 'md' ? 'text-xl' : 'text-base';
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <p className={`font-display leading-none text-bronze-light ${wordmark}`}>Ta&rsquo; Spiru</p>
      <Tagline className={`mt-2 text-bronze ${script}`} />
    </div>
  );
};

/** Branded stream mark: "The Barber" / "The Car Wash" in the brand script. */
export const StreamMark = ({
  kind,
  className = '',
}: {
  kind: 'BARBER' | 'WASH';
  className?: string;
}): JSX.Element => (
  <span
    className={`font-script ${kind === 'BARBER' ? 'text-bronze-light' : 'text-wash-light'} ${className}`}
  >
    {kind === 'BARBER' ? 'The Barber' : 'The Car Wash'}
  </span>
);
