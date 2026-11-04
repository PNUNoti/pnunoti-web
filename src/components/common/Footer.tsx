import Container from "./Container";

// 본문(홈 히어로·기능 소개)과 같은 폭과 왼쪽 선에 맞추고, 작은 회색 글씨로 조용하게 쌓는다.
const Footer = () => {
  return (
    <footer className="border-t border-tds-grey-100 bg-tds-grey-50 py-10 text-[13px] leading-[1.8] text-tds-grey-500">
      <Container>
        <div className="mx-auto max-w-3xl px-3 sm:px-0">
          <p className="font-semibold text-tds-grey-700">PNU Noti</p>
          <p className="mt-1">부산대 공지사항 알리미</p>
          <p>
            문의{" "}
            <a
              href="mailto:pnunotice@gmail.com"
              className="text-tds-grey-600 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue"
            >
              pnunotice@gmail.com
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
