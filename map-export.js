export const HAND_DRAWN_PROMPT = `Create a masterpiece-level hand-drawn urban planning map based on the provided 3D miniature city map screenshot. The style should merge technical accuracy with artistic cartography.

Visual Style:
Ink and watercolor wash aesthetic, but with the precision of a CAD drawing.
Vibrant but natural color palette, with subtle watercolor paper texture.

Detailed Elements:
Buildings: Hand-inked outlines with a slight bevel effect for dimensionality.
Nature: Trees should be represented by individual distinct circular canopies for street trees, and textured green washes for parks.
Water: Watercolor texture blue with defined banks.
Roads: Clearly defined clean paths, varying in width based on their prominence in the reference.

Composition:
High level of detail, covering visible semantic classes such as sidewalks, swimming pools, and medians where present in the reference. The result should look like a finalized vector illustration ready for print.

Preserve the exact camera angle, framing, terrain silhouette, building positions, road network, bridges, and shoreline. Change only the rendering style of the city and terrain. Do not invent, remove, relocate, or reshape buildings, roads, bridges, landmarks, or terrain features. Artistic watercolor sky and clouds are welcome within the existing sky area, without obscuring or altering the city or mountain silhouettes. No interface elements, labels, or added text.`;

// Copy immediately after rendering: the WebGL drawing buffer can be cleared
// after this task. Only scene pixels are copied, never the surrounding HTML UI.
export function captureMapCanvas(city) {
  const ratio=city.renderer.getPixelRatio();
  const fullRatio=city.restPixelRatio??ratio;
  try {
    if(fullRatio!==ratio)city.setRenderPixelRatio(fullRatio);
    const source = city.renderer.domElement;
    if (!source.width || !source.height) throw new Error('지도 크기를 확인할 수 없습니다.');
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext('2d');
    if (!context) throw new Error('이미지를 만들 수 없습니다.');
    if (city.fastRender || city.overview) city.renderer.render(city.scene, city.camera);
    else city.focus.render(city.camera.position.distanceTo(city.controls.target));
    context.drawImage(source, 0, 0);
    return copy;
  } finally {
    if(fullRatio!==ratio)city.setRenderPixelRatio(ratio);
  }
}

function imageFilename(cityId) {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((v, i) => i ? String(v).padStart(2, '0') : v).join('');
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(v => String(v).padStart(2, '0')).join('');
  return `${cityId || 'map'}-3d-${date}-${time}-${String(now.getMilliseconds()).padStart(3, '0')}.png`;
}

export function mountMapExport(city, button) {
  const dialog = document.createElement('dialog');
  dialog.id = 'map-export';
  dialog.className = 'card';
  dialog.setAttribute('aria-labelledby', 'map-export-title');
  dialog.innerHTML = `
    <div class="export-head"><h2 id="map-export-title">지도를 손그림으로</h2><button type="button" id="export-close" aria-label="지도 저장 창 닫기">×</button></div>
    <p class="export-intro">현재 시점의 지도만 저장합니다. 버튼·패널·이름표는 포함되지 않습니다.</p>
    <img id="export-preview" alt="다운로드할 지도 캡처" hidden>
    <p id="export-status" role="status" aria-live="polite"></p>
    <a id="export-download" class="export-primary" hidden>1. 지도 이미지 다운로드</a>
    <div class="export-step"><strong>2. 손그림 프롬프트 복사</strong><button type="button" id="export-copy">프롬프트 복사</button></div>
    <p id="export-copy-status" role="status" aria-live="polite"></p>
    <details><summary>프롬프트 보기</summary><textarea id="export-prompt" readonly aria-label="손그림 변환 프롬프트" spellcheck="false"></textarea></details>
    <p class="export-help">저장한 이미지와 프롬프트를 이미지 생성 도구에 함께 넣어주세요. 추천 모델: GPT Image 2.5 Sunburst. 구름 표현은 허용하고 지도 구조는 유지하도록 요청합니다.</p>`;
  document.body.append(dialog);
  const preview = dialog.querySelector('#export-preview');
  const status = dialog.querySelector('#export-status');
  const download = dialog.querySelector('#export-download');
  const text = dialog.querySelector('#export-prompt');
  const copyStatus = dialog.querySelector('#export-copy-status');
  text.value = HAND_DRAWN_PROMPT;
  let imageUrl = null, request = 0;
  const clearImage = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
    preview.removeAttribute('src');
    preview.hidden = download.hidden = true;
    download.removeAttribute('href');
  };
  dialog.addEventListener('close', () => { request++; clearImage(); });
  dialog.querySelector('#export-close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  button.disabled = false;
  button.onclick = async () => {
    const current = ++request;
    button.disabled = true;
    clearImage();
    copyStatus.textContent = '';
    status.textContent = '지도 이미지를 준비하고 있습니다…';
    try {
      // Capture the camera at the click, before opening the dialog or yielding.
      const canvas = captureMapCanvas(city);
      const filename = imageFilename(city.cityId);
      dialog.showModal();
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 저장 준비에 실패했습니다.')), 'image/png'));
      if (current !== request || !dialog.open) return;
      imageUrl = URL.createObjectURL(blob);
      preview.src = download.href = imageUrl;
      download.download = filename;
      preview.hidden = download.hidden = false;
      status.textContent = `${canvas.width} × ${canvas.height} · PNG · 화면 비율과 시점 유지`;
    } catch (error) {
      if (current !== request) return;
      if (!dialog.open) dialog.showModal();
      status.textContent = '캡처하지 못했습니다. 창을 닫고 다시 시도해주세요.';
      console.warn('Map capture failed:', error);
    } finally {
      button.disabled = false;
    }
  };
  dialog.querySelector('#export-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(HAND_DRAWN_PROMPT);
      copyStatus.textContent = '프롬프트를 복사했습니다.';
    } catch {
      // Works when clipboard permission is denied or on non-secure origins.
      dialog.querySelector('details').open = true;
      text.focus();
      text.select();
      text.setSelectionRange(0, text.value.length);
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Keep selected for manual copy. */ }
      copyStatus.textContent = copied ? '프롬프트를 복사했습니다.' : '프롬프트를 선택했습니다. ⌘C 또는 Ctrl+C로 복사해주세요.';
    }
  };
}
