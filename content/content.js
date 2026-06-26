// 네이버 블로그 에디터 자동 입력 content script

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'INSERT_POST') {
    insertPost(msg).then(sendResponse);
    return true;
  }
});

async function insertPost({ title, content }) {
  try {
    // 에디터 로드 대기 (최대 10초)
    await waitForEditor(10000);

    // 제목 입력
    const titleInput = document.querySelector('.se-title-input') ||
                       document.querySelector('[placeholder*="제목"]') ||
                       document.querySelector('.tit_area input') ||
                       document.querySelector('#subject');

    if (titleInput) {
      titleInput.focus();
      titleInput.value = title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await delay(500);

    // 스마트에디터 3.0 (se-main-container)
    const seEditor = document.querySelector('.se-main-container');
    if (seEditor) {
      await insertIntoSmartEditor(content);
      sendResponse({ success: true });
      return;
    }

    // 구형 에디터 (iframe 방식)
    const iframe = document.querySelector('iframe[id*="editor"]') ||
                   document.querySelector('iframe[name*="editor"]');
    if (iframe) {
      const iDoc = iframe.contentDocument || iframe.contentWindow.document;
      const body = iDoc.querySelector('[contenteditable="true"]') || iDoc.body;
      if (body) {
        body.focus();
        body.innerHTML = content.replace(/\n/g, '<br>');
      }
      sendResponse({ success: true });
      return;
    }

    // 폴백: contenteditable 영역 찾기
    const editable = document.querySelector('[contenteditable="true"]');
    if (editable) {
      editable.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, content);
    }

    sendResponse({ success: true });
  } catch (e) {
    sendResponse({ success: false, error: e.message });
  }
}

async function insertIntoSmartEditor(content) {
  // 스마트에디터 3.0에 텍스트 입력
  const paragraphs = content.split('\n').filter(p => p.trim());
  const container = document.querySelector('.se-main-container');
  if (!container) return;

  container.click();
  await delay(300);

  // 첫 번째 편집 가능한 단락 찾기
  const firstPara = container.querySelector('[contenteditable="true"]') ||
                    container.querySelector('.se-component');

  if (firstPara) {
    firstPara.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, content);
  }
}

function waitForEditor(timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const hasEditor = document.querySelector('.se-main-container') ||
                        document.querySelector('iframe[id*="editor"]') ||
                        document.querySelector('[contenteditable="true"]');

      if (hasEditor) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('에디터를 찾을 수 없습니다.'));
      setTimeout(check, 500);
    };
    check();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
