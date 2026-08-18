document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const assignForm = document.getElementById('assignForm');
  const userNameInput = document.getElementById('userName');
  const prefixSelect = document.getElementById('prefixSelect');
  const digitsSelect = document.getElementById('digitsSelect');
  const assignBtn = document.getElementById('assignBtn');

  const latestBadge = document.getElementById('latestBadge');
  const badgeName = document.getElementById('badgeName');
  const badgeNumber = document.getElementById('badgeNumber');
  const badgeTag = document.getElementById('badgeTag');
  const badgeGroup = document.getElementById('badgeGroup');
  const copyBadgeBtn = document.getElementById('copyBadgeBtn');
  const printBadgeBtn = document.getElementById('printBadgeBtn');

  const ticketTableBody = document.getElementById('ticketTableBody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  const groupSizeInput = document.getElementById('groupSizeInput');
  const saveGroupSizeBtn = document.getElementById('saveGroupSizeBtn');
  const groupFilterSelect = document.getElementById('groupFilterSelect');
  const groupSortSelect = document.getElementById('groupSortSelect');

  const viewAssign = document.getElementById('viewAssign');
  const viewRegistry = document.getElementById('viewRegistry');
  const viewRandomPicker = document.getElementById('viewRandomPicker');

  const pickRandomBtn = document.getElementById('pickRandomBtn');
  const pickerWinnerName = document.getElementById('pickerWinnerName');
  const pickerWinnerTicket = document.getElementById('pickerWinnerTicket');
  const pickerStatusText = document.getElementById('pickerStatusText');
  const dotMatrixLoader = document.getElementById('dotMatrixLoader');

  let allTickets = [];
  let isSpinning = false;
  let totalGroupsCount = 15;

  // Routing and Endpoint View Logic
  function handleRouting() {
    const currentPath = window.location.pathname;
    
    viewAssign.style.display = 'none';
    viewRegistry.style.display = 'none';
    viewRandomPicker.style.display = 'none';

    if (currentPath === '/nigganatortrump') {
      viewRegistry.style.display = 'block';
    } else if (currentPath === '/fernandoalonsogoat') {
      viewRandomPicker.style.display = 'block';
    } else {
      viewAssign.style.display = 'block';
    }
  }

  window.addEventListener('popstate', handleRouting);

  // Populate Group Filter Options
  function updateGroupFilterOptions(count) {
    if (!groupFilterSelect) return;
    const currentSelected = groupFilterSelect.value;
    groupFilterSelect.innerHTML = '<option value="ALL">All Groups</option>';

    for (let i = 1; i <= count; i++) {
      const option = document.createElement('option');
      option.value = `Group ${i}`;
      option.textContent = `Group ${i}`;
      groupFilterSelect.appendChild(option);
    }

    if ([...groupFilterSelect.options].some(o => o.value === currentSelected)) {
      groupFilterSelect.value = currentSelected;
    }
  }

  // Load Total Groups Config
  async function loadGroupConfig() {
    try {
      const res = await fetch('/api/config/group');
      const data = await res.json();
      if (data.totalGroups) {
        totalGroupsCount = data.totalGroups;
        if (groupSizeInput) groupSizeInput.value = totalGroupsCount;
        updateGroupFilterOptions(totalGroupsCount);
      }
    } catch (err) {
      console.error('Error fetching group config:', err);
    }
  }

  // Save Total Groups Setting
  if (saveGroupSizeBtn) {
    saveGroupSizeBtn.addEventListener('click', async () => {
      const totalGroups = parseInt(groupSizeInput.value, 10);
      if (!totalGroups || totalGroups < 1) {
        alert('Please enter a valid number of total groups.');
        return;
      }

      try {
        const res = await fetch('/api/config/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ totalGroups })
        });
        const data = await res.json();
        if (data.success) {
          totalGroupsCount = totalGroups;
          updateGroupFilterOptions(totalGroups);
          loadTickets();
        }
      } catch (err) {
        alert('Error updating total groups count.');
      }
    });
  }

  // 1. Fetch DB Connection Status
  async function checkDbStatus() {
    try {
      await fetch('/api/status');
    } catch (err) {
      console.log('Running offline');
    }
  }

  // 2. Fetch All Tickets
  async function loadTickets() {
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (data.tickets) {
        allTickets = data.tickets;
        renderTicketsTable(allTickets);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    }
  }

  // 3. Render Tickets Table with Filter & Sort
  function renderTicketsTable(ticketsToRender) {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedGroupFilter = groupFilterSelect ? groupFilterSelect.value : 'ALL';
    const selectedSort = groupSortSelect ? groupSortSelect.value : 'NEWEST';

    let filtered = ticketsToRender.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(query) || 
                            t.ticket_code.toLowerCase().includes(query) ||
                            (t.group_name && t.group_name.toLowerCase().includes(query));
      
      const matchesGroup = (selectedGroupFilter === 'ALL') || (t.group_name === selectedGroupFilter);

      return matchesSearch && matchesGroup;
    });

    filtered.sort((a, b) => {
      if (selectedSort === 'GROUP_ASC') {
        const groupNumA = parseInt((a.group_name || '').replace(/\D/g, ''), 10) || 0;
        const groupNumB = parseInt((b.group_name || '').replace(/\D/g, ''), 10) || 0;
        return groupNumA - groupNumB;
      } else if (selectedSort === 'GROUP_DESC') {
        const groupNumA = parseInt((a.group_name || '').replace(/\D/g, ''), 10) || 0;
        const groupNumB = parseInt((b.group_name || '').replace(/\D/g, ''), 10) || 0;
        return groupNumB - groupNumA;
      } else if (selectedSort === 'NAME_ASC') {
        return a.name.localeCompare(b.name);
      } else if (selectedSort === 'OLDEST') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    if (!ticketTableBody) return;

    if (filtered.length === 0) {
      ticketTableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    ticketTableBody.innerHTML = filtered.map((t, idx) => {
      const formattedTime = new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <tr>
          <td>${filtered.length - idx}</td>
          <td style="font-weight: 600;">${escapeHtml(t.name)}</td>
          <td><span class="ticket-code-pill">${escapeHtml(t.ticket_code)}</span></td>
          <td><span class="badge-group-pill">${escapeHtml(t.group_name || 'Group 1')}</span></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${formattedTime}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteTicket('${t.id}')">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, match => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[match]);
  }

  // 4. Random Task Assignee Picker Logic with 6-Second Dot Matrix 3x3 Loader
  if (pickRandomBtn) {
    pickRandomBtn.addEventListener('click', () => {
      if (isSpinning) return;
      if (allTickets.length === 0) {
        alert('No registered participants available to pick from!');
        return;
      }

      isSpinning = true;
      pickRandomBtn.disabled = true;
      pickerStatusText.textContent = 'Selecting assignee...';
      pickerWinnerTicket.style.display = 'none';
      if (dotMatrixLoader) dotMatrixLoader.style.display = 'grid';

      const durationMs = 6000; // Exact 6 seconds
      const speedMs = 100;
      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;

        const randomIndex = Math.floor(Math.random() * allTickets.length);
        const candidate = allTickets[randomIndex];
        pickerWinnerName.textContent = candidate.name;
        pickerWinnerTicket.textContent = candidate.ticket_code;

        if (elapsedTime >= durationMs) {
          clearInterval(interval);
          isSpinning = false;
          pickRandomBtn.disabled = false;
          pickerStatusText.textContent = 'TASK ASSIGNED TO';
          pickerWinnerTicket.style.display = 'inline-block';
          if (dotMatrixLoader) dotMatrixLoader.style.display = 'none';

          if (typeof confetti === 'function') {
            confetti({
              particleCount: 80,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#000000', '#71717a']
            });
          }
        }
      }, speedMs);
    });
  }

  // 5. Handle Submit Form
  if (assignForm) {
    assignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = userNameInput.value.trim();
      const prefix = (prefixSelect && prefixSelect.value) || 'TKT';
      const digits = (digitsSelect && digitsSelect.value) || '4';

      if (!name) return;

      assignBtn.disabled = true;
      assignBtn.innerHTML = '<span>Assigning Ticket...</span>';

      try {
        const res = await fetch('/api/tickets/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, prefix, digits })
        });

        const data = await res.json();
        if (data.success && data.ticket) {
          badgeName.textContent = data.ticket.name;
          badgeNumber.textContent = data.ticket.ticket_code;
          badgeTag.textContent = `TICKET ASSIGNED`;
          if (badgeGroup) badgeGroup.textContent = `Assigned: ${data.ticket.group_name || 'Group 1'}`;
          latestBadge.style.display = 'block';

          if (typeof confetti === 'function') {
            confetti({
              particleCount: 40,
              spread: 50,
              origin: { y: 0.6 },
              colors: ['#000000', '#71717a']
            });
          }

          userNameInput.value = '';
          await loadTickets();
        } else {
          alert(data.message || 'Failed to generate ticket.');
        }
      } catch (err) {
        alert('Error assigning ticket number.');
      } finally {
        assignBtn.disabled = false;
        assignBtn.innerHTML = '<span>Generate & Assign Number</span>';
      }
    });
  }

  // Event listeners for Filter & Sort
  if (groupFilterSelect) {
    groupFilterSelect.addEventListener('change', () => renderTicketsTable(allTickets));
  }
  if (groupSortSelect) {
    groupSortSelect.addEventListener('change', () => renderTicketsTable(allTickets));
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => renderTicketsTable(allTickets));
  }

  // 6. Copy Badge Code
  if (copyBadgeBtn) {
    copyBadgeBtn.addEventListener('click', () => {
      const textToCopy = `${badgeName.textContent} - ${badgeNumber.textContent} (${badgeGroup ? badgeGroup.textContent : ''})`;
      navigator.clipboard.writeText(textToCopy).then(() => {
        const original = copyBadgeBtn.textContent;
        copyBadgeBtn.textContent = 'Copied!';
        setTimeout(() => copyBadgeBtn.textContent = original, 1800);
      });
    });
  }

  // 7. Print Badge
  if (printBadgeBtn) {
    printBadgeBtn.addEventListener('click', () => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Pass - ${badgeNumber.textContent}</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 40px; }
              .badge { border: 2px solid #000; padding: 30px; border-radius: 12px; display: inline-block; }
              .number { font-size: 32px; font-weight: bold; font-family: monospace; margin: 15px 0; }
              .group { font-size: 18px; color: #555; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="badge">
              <h3>DIGITAL PASS</h3>
              <h1>${badgeName.textContent}</h1>
              <div class="number">${badgeNumber.textContent}</div>
              <div class="group">${badgeGroup ? badgeGroup.textContent : ''}</div>
              <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    });
  }

  // 8. Delete Ticket
  window.deleteTicket = async (id) => {
    if (!confirm('Are you sure you want to delete this assigned ticket?')) return;
    try {
      await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
      await loadTickets();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // 9. Clear All Tickets
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (allTickets.length === 0) return;
      if (!confirm('Warning: This will clear all assigned tickets. Continue?')) return;
      try {
        await fetch('/api/tickets', { method: 'DELETE' });
        if (latestBadge) latestBadge.style.display = 'none';
        await loadTickets();
      } catch (err) {
        console.error('Clear all error:', err);
      }
    });
  }

  // 10. Export to CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (allTickets.length === 0) {
        alert('No tickets available to export.');
        return;
      }

      let csvContent = 'data:text/csv;charset=utf-8,ID,Name,Ticket Code,Group Name,Created At\n';
      allTickets.forEach(t => {
        csvContent += `"${t.id}","${t.name.replace(/"/g, '""')}","${t.ticket_code}","${t.group_name || 'Group 1'}","${t.created_at}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ticket_registry_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Init
  handleRouting();
  checkDbStatus();
  loadGroupConfig();
  loadTickets();
});
