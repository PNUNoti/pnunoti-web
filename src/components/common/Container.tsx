interface Props {
  children?: React.ReactNode;
}

function Container({ children }: Props): React.ReactNode {
  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">{children}</div>
  );
}

export default Container;
