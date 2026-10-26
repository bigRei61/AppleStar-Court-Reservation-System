import Image from "next/image";
import Link from "next/link";
import { venue } from "@/lib/config";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label={`${venue.name} home`}>
      <span className="brand-logo-frame">
        <Image
          src="/images/starapple-logo.png"
          width={1414}
          height={650}
          sizes="(max-width: 900px) 78px, 108px"
          alt=""
          className="brand-logo"
          loading="eager"
        />
      </span>
      <span>{venue.shortName}<small>PICKLEBALL VENUE</small></span>
    </Link>
  );
}
