const refs = {
  participantCount: document.querySelector("#participantCount"),
  adminRows: document.querySelector("#adminRows"),
};

renderAdminTable();

async function renderAdminTable() {
  try {
    const response = await fetch("/api/admin/participants");
    if (!response.ok) {
      throw new Error("load failed");
    }

    const data = await response.json();
    const participants = data.participants || [];
    refs.participantCount.textContent = `${participants.length} 人`;
    refs.adminRows.innerHTML = "";

    if (!participants.length) {
      refs.adminRows.innerHTML = `
        <tr>
          <td colspan="3">目前還沒有資料。</td>
        </tr>
      `;
      return;
    }

    participants.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.order}</td>
        <td>${escapeHtml(entry.name || "")}</td>
        <td>${entry.score || 0}</td>
      `;
      refs.adminRows.appendChild(row);
    });
  } catch (error) {
    refs.adminRows.innerHTML = `
      <tr>
        <td colspan="3">後台資料讀取失敗。</td>
      </tr>
    `;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
