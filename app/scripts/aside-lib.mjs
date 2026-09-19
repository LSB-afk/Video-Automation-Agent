const supported = url => /^https:\/\/tutor-t\.thinkforbl\.com\/courses\/\d+\/?(?:[?#].*)?$/.test(url);
export const discoveryCode = pinned => `return (await listBrowserTabs()).filter(t => t.targetId === ${JSON.stringify(pinned)} ||
  new RegExp(${JSON.stringify(String.raw`^https://tutor-t\.thinkforbl\.com/courses/\d+/?(?:[?#].*)?$`)}).test(t.url)).map(t => ({targetId:t.targetId,url:t.url}));`;
export function chooseTarget(command, tabs, pinned, requestedUrl) {
  if (command !== 'start') {
    if (!pinned) throw new Error('not_started');
    if (!tabs.some(tab => tab.targetId === pinned)) throw new Error('tab_closed');
    return pinned;
  }
  const matches = tabs.filter(tab => supported(tab.url) && (!requestedUrl ||
    new URL(tab.url).pathname.replace(/\/$/, '') === new URL(requestedUrl).pathname.replace(/\/$/, '')));
  if (requestedUrl && !supported(requestedUrl)) throw new Error('unsupported_course_url');
  if (matches.length !== 1) throw new Error(matches.length ? 'multiple_course_tabs' : 'waiting_for_course');
  return matches[0].targetId;
}
export function parseResult(output) {
  const lines = output.replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter(line => line.includes('VAA_RESULT:'));
  if (!lines.length) throw new Error('aside_command_failed');
  const payload = JSON.parse(lines.at(-1).split('VAA_RESULT:')[1].trim());
  if (payload?._error) throw new Error('connection_failed');
  return payload;
}
