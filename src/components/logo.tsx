import Image from 'next/image';
import * as React from 'react';

const Logo = ({ className }: { className?: string }) => (
  <Image
    src="https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/ess_logo-e1535981160563.jpg?alt=media&token=ce9dd159-f885-49b5-a7e9-f13d35d007c1"
    alt="European Social Survey Logo"
    width={150}
    height={40}
    className={className}
    priority
  />
);

export default Logo;
