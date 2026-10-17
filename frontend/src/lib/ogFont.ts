/**
 * 공유 이미지(next/og) 안의 한글을 그리려면 글꼴이 필요하다. 쓰는 글자만 담은 Black Han Sans 를 Google Fonts 에서 받는다.
 * 받지 못하면(네트워크 차단 등) null → 기본 글꼴로 그린다.
 */
export async function loadOgFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(
      `https://fonts.googleapis.com/css2?family=Black+Han+Sans&text=${encodeURIComponent(text)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    )).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}
