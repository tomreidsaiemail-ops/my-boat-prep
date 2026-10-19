export const Highlight = ({ text, query }) => {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<mark className="rounded bg-amber-200 px-0.5 text-inherit" data-testid="search-highlight">{text.slice(at, at + query.length)}</mark>{text.slice(at + query.length)}</>;
};
