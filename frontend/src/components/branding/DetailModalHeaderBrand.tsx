/** Login sayfasındaki resmi belediye logosu (card #1683 reopen). */
const DETAIL_HEADER_LOGIN_LOGO_SRC = '/tire-belediyesi-logo.png'

/** Detay popup başlık satırı ortası — login page logosu, küçültülmüş. */
export function DetailModalHeaderBrand() {
  return (
    <div className="detail-modal-header-brand" aria-hidden="true">
      <img
        src={DETAIL_HEADER_LOGIN_LOGO_SRC}
        alt=""
        className="detail-modal-header-brand__img"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
