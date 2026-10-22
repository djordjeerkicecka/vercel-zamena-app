// The existing vector wordmark from TENZIA's storefront header.
export function TenziaMark({ className = "h-auto w-[180px]" }: { className?: string }) {
  return (
    <svg
      width="212"
      height="32"
      viewBox="0 0 212 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="TENZIA"
      className={className}
    >
      <path d="M73.981 0.0961914H40.3911V7.01459H73.981V0.0961914Z" />
      <path d="M73.981 12.5889H40.3911V19.5073H73.981V12.5889Z" />
      <path d="M73.981 25.0815H40.3911V31.9999H73.981V25.0815Z" />
      <path d="M155.94 0.0961914H122.35V7.01459H155.94V0.0961914Z" />
      <path d="M155.94 25.0815H122.35V31.9999H155.94V25.0815Z" />
      <path d="M33.0012 0.0961914H20.3331H12.6682H0V7.76339H12.6682V32.0002H20.3331V7.76339H33.0012V0.0961914Z" />
      <path d="M171.021 0H163.336V32H171.021V0Z" />
      <path d="M107.168 0.0961914V21.325L89.1698 0.0961914H81.3706V32.0002H89.1698V10.7714L107.168 32.0002H114.96V0.0961914H107.168Z" />
      <path d="M189.671 25.7473L187.771 31.9553H178.404L188.775 0.0512695H201.219L212 31.9553H201.962L199.972 25.7473H189.671ZM198.283 18.8161C196.741 13.8049 195.48 9.34407 194.738 6.23367H194.604C193.842 9.67047 192.588 14.2209 191.258 18.8161H198.283Z" />
      <path d="M139.132 12.5312L128.851 19.5072H139.164L149.446 12.5312H139.132Z" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="mb-8 flex justify-center py-2 text-black">
      <TenziaMark />
    </div>
  );
}
