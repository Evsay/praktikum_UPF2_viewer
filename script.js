  const loadBtn = document.getElementById('loadBtn');
    const fileInput = document.getElementById('fileInput');
    const textArea = document.getElementById('textArea');
  const rawSplitView = document.getElementById('rawSplitView');
    const rawEditActions = document.getElementById('rawEditActions');
    const keepEditedFileBtn = document.getElementById('keepEditedFileBtn');
    const createEditedFileBtn = document.getElementById('createEditedFileBtn');
    const discardEditedFileBtn = document.getElementById('discardEditedFileBtn');
    const singleViewBtn = document.getElementById('singleViewBtn');
    const multiViewBtn = document.getElementById('multiViewBtn');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const descPanel = document.getElementById('descPanel');
    const chartArea = document.getElementById('chartArea');
    const chartCard = document.querySelector('.chart-card');
    const chartInfo = document.getElementById('chartInfo');
    const dualValueToggleBtn = document.getElementById('dualValueToggleBtn');
    const stepToggleBtn = document.getElementById('stepToggleBtn');
    const compareToggleBtn = document.getElementById('compareToggleBtn');
    const favoritesSortToggleBtn = document.getElementById('favoritesSortToggleBtn');
    const descSelector = document.getElementById('descSelector');
    const descSearchInput = document.getElementById('descSearchInput');
    const loadedFilesEl = document.getElementById('loadedFiles');
    const fileActionModal = document.getElementById('fileActionModal');
    const actionRenameBtn = document.getElementById('actionRenameBtn');
    const actionRecolorBtn = document.getElementById('actionRecolorBtn');
    const actionDeleteBtn = document.getElementById('actionDeleteBtn');
    const actionCloseBtn = document.getElementById('actionCloseBtn');
    const fileColorChoices = document.getElementById('fileColorChoices');
    const colorChoiceButtons = document.querySelectorAll('.color-choice');
    let chartInstance = null;
    let currentDescValues = [];
    let currentRawContent = '';
    let selectedDescIndex = 0;
    let secondaryDescIndex = 1;
    let useListView = true;
    let currentDescText = '';
    let currentThingValueType = '';
    let loadedFiles = [];
    let activeFileIndex = -1;
    let modalFileIndex = -1;
    let activeFileColor = '';
    let useStepDiagram = false;
    let useDualValueChart = false;
    let favoriteDescIds = [];
    let favoritesSortEnabled = true;
    let showAllFilesInChart = false;
    let showRawSplitView = false;
    let rawViewMode = 'single';
    const selectedFileIds = new Set();
    const storageKey = 'upf2ViewerState.v1';
    let descIdToName = {};
    let activeMetadataFileId = null;

    const seriesPalette = ['#0f766e', '#0284c7', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2'];

    function parseMeasurementMetadata(xmlText) {
      const mapping = {};
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const dtElements = xmlDoc.querySelectorAll('DT[upfDTid]');

      dtElements.forEach((dt) => {
        const upfId = dt.getAttribute('upfDTid');
        const nameEl = dt.querySelector('Name[Lang="en"]');
        if (upfId && nameEl && nameEl.textContent) {
          mapping[upfId] = nameEl.textContent.trim();
        }
      });

      return mapping;
    }

    function applyMeasurementMetadata(mapping) {
      descIdToName = mapping || {};

      if (currentRawContent && !isXmlEntry(loadedFiles[activeFileIndex])) {
        formatDesc(extractDesc(currentRawContent));
      }
    }

    function setActiveMetadataFileId(fileId) {
      activeMetadataFileId = fileId;
      const metadataEntry = loadedFiles.find((entry) => entry.id === fileId && isXmlEntry(entry));
      if (!metadataEntry) {
        applyMeasurementMetadata({});
        return;
      }

      const mapping = parseMeasurementMetadata(metadataEntry.content || '');
      applyMeasurementMetadata(mapping);
    }

    function loadMeasurementMetadata() {
      fetch('itdt_utf-8.xml')
        .then((response) => response.text())
        .then((xmlText) => {
          if (activeMetadataFileId) {
            return;
          }
          const mapping = parseMeasurementMetadata(xmlText);
          applyMeasurementMetadata(mapping);
        })
        .catch((err) => console.warn('Could not load measurement metadata:', err));
    }

    function getMeasurementName(id) {
      return descIdToName[String(id)] || String(id);
    }

    function readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result || '');
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsText(file);
      });
    }

    function getSeriesColor(entry, index) {
      return (entry && entry.color) || seriesPalette[index % seriesPalette.length];
    }

    function getFileKind(fileName) {
      const lowerName = (fileName || '').toLowerCase();
      return lowerName.endsWith('.xml') ? 'xml' : 'upf';
    }

    function isXmlEntry(entry) {
      return entry && entry.kind === 'xml';
    }

    function persistState() {
      try {
        const payload = {
          loadedFiles,
          activeFileId: loadedFiles[activeFileIndex] ? loadedFiles[activeFileIndex].id : null,
          activeMetadataFileId,
          rawViewMode,
          selectedFileIds: Array.from(selectedFileIds),
          showAllFilesInChart,
          useStepDiagram,
          useDualValueChart,
          secondaryDescIndex,
          favoriteDescIds,
          favoritesSortEnabled
        };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (error) {
        // Ignore persistence errors (e.g., storage quota exceeded).
      }
    }

    function restoreState() {
      let parsed;

      try {
        const storedValue = window.localStorage.getItem(storageKey);
        if (!storedValue) {
          return;
        }
        parsed = JSON.parse(storedValue);
      } catch (error) {
        return;
      }

      const files = Array.isArray(parsed.loadedFiles)
        ? parsed.loadedFiles
            .map((entry) => ({
              id: typeof entry.id === 'string' ? entry.id : '',
              name: typeof entry.name === 'string' ? entry.name : 'Unnamed file',
              color: typeof entry.color === 'string' ? entry.color : '',
              content: typeof entry.content === 'string' ? entry.content : '',
              kind: typeof entry.kind === 'string' ? entry.kind : getFileKind(entry.name)
            }))
            .filter((entry) => entry.id && entry.name)
        : [];

      if (!files.length) {
        return;
      }

      loadedFiles = files;
      const restoredMetadataId = typeof parsed.activeMetadataFileId === 'string' ? parsed.activeMetadataFileId : null;
      if (restoredMetadataId && loadedFiles.some((entry) => entry.id === restoredMetadataId && isXmlEntry(entry))) {
        setActiveMetadataFileId(restoredMetadataId);
      }
      selectedFileIds.clear();

      const restoredSelectedIds = Array.isArray(parsed.selectedFileIds) ? parsed.selectedFileIds : [];
      restoredSelectedIds.forEach((id) => {
        if (typeof id === 'string' && loadedFiles.some((entry) => entry.id === id)) {
          selectedFileIds.add(id);
        }
      });

      rawViewMode = parsed.rawViewMode === 'multiple' ? 'multiple' : 'single';
      showRawSplitView = rawViewMode === 'multiple';
      showAllFilesInChart = Boolean(parsed.showAllFilesInChart);
      useStepDiagram = Boolean(parsed.useStepDiagram);
      useDualValueChart = Boolean(parsed.useDualValueChart);
      secondaryDescIndex = Number.isInteger(parsed.secondaryDescIndex) ? parsed.secondaryDescIndex : 1;
      favoriteDescIds = Array.isArray(parsed.favoriteDescIds)
        ? parsed.favoriteDescIds.filter((id) => typeof id === 'string')
        : [];
      favoritesSortEnabled = parsed.favoritesSortEnabled !== false;
      updateStepToggleButton();
      updateDualValueToggleButton();
      updateFavoritesSortToggleButton();
      updateCompareToggleButton();
      updateViewModeButtons();

      const restoredActiveId = typeof parsed.activeFileId === 'string' ? parsed.activeFileId : '';
      const restoredActiveIndex = loadedFiles.findIndex((entry) => entry.id === restoredActiveId);
      const nextIndex = restoredActiveIndex >= 0 ? restoredActiveIndex : 0;

      if (rawViewMode === 'multiple' && !selectedFileIds.size && loadedFiles[nextIndex]) {
        selectedFileIds.add(loadedFiles[nextIndex].id);
      }

      setActiveFile(nextIndex, {
        keepSplitView: rawViewMode === 'multiple',
        preserveMode: true,
        syncMultiSelection: false
      });

      renderLoadedFiles();
      updateRawTabView();
    }

    function createManualFileId() {
      return `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function promptForFileName(defaultName = 'new_file.upf2') {
      const nextName = window.prompt('Name for the new file:', defaultName);
      return sanitizeFileName(nextName);
    }

    function createFileEntry(name, content) {
      return {
        id: createManualFileId(),
        name,
        color: '',
        content,
        kind: getFileKind(name)
      };
    }

    function updateRawEditActions() {
      if (!rawEditActions || !textArea) {
        return;
      }

      const activeEntry = loadedFiles[activeFileIndex];
      const canEditInSingleMode = rawViewMode === 'single' && !textArea.classList.contains('hidden');
      const isDirty = Boolean(activeEntry) && textArea.value !== activeEntry.content;

      rawEditActions.classList.toggle('hidden', !(canEditInSingleMode && isDirty));
    }

    function createNewFileFromEditor(content, defaultName) {
      const fileName = promptForFileName(defaultName);
      if (!fileName) {
        return null;
      }

      const newEntry = createFileEntry(fileName, content);
      loadedFiles.push(newEntry);
      persistState();
      const newIndex = loadedFiles.length - 1;
      setActiveFile(newIndex, { preserveMode: true, syncMultiSelection: false });
      return newEntry;
    }

    function updateCompareToggleButton() {
      compareToggleBtn.textContent = showAllFilesInChart ? 'All Files: ON' : 'All Files: OFF';
      compareToggleBtn.classList.toggle('active', showAllFilesInChart);
    }

    function updateStepToggleButton() {
      if (!stepToggleBtn) {
        return;
      }

      stepToggleBtn.textContent = useStepDiagram ? 'Step Diagram: ON' : 'Step Diagram: OFF';
      stepToggleBtn.classList.toggle('active', useStepDiagram);
    }

    function updateViewModeButtons() {
      if (singleViewBtn) {
        singleViewBtn.classList.toggle('active', rawViewMode === 'single');
      }
      if (multiViewBtn) {
        multiViewBtn.classList.toggle('active', rawViewMode === 'multiple');
      }
    }

    function setRawViewMode(mode) {
      rawViewMode = mode === 'multiple' ? 'multiple' : 'single';
      showRawSplitView = rawViewMode === 'multiple';

      if (rawViewMode === 'multiple' && activeFileIndex >= 0 && loadedFiles[activeFileIndex]) {
        selectedFileIds.add(loadedFiles[activeFileIndex].id);
      }

      updateViewModeButtons();
      updateRawTabView();
      renderLoadedFiles();
      updateRawEditActions();
      persistState();
    }

    function getSplitViewFiles() {
      const selectedFiles = loadedFiles.filter((entry) => selectedFileIds.has(entry.id));
      if (selectedFiles.length > 0) {
        return selectedFiles;
      }

      const activeFile = loadedFiles[activeFileIndex];
      return activeFile ? [activeFile] : [];
    }

    function sanitizeFileName(name) {
      const cleaned = (name || '').trim();
      return cleaned.length ? cleaned : null;
    }

    function hexToRgba(hex, alpha) {
      if (typeof hex !== 'string') {
        return '';
      }

      const normalized = hex.trim().replace('#', '');
      if (normalized.length !== 6) {
        return '';
      }

      const r = Number.parseInt(normalized.slice(0, 2), 16);
      const g = Number.parseInt(normalized.slice(2, 4), 16);
      const b = Number.parseInt(normalized.slice(4, 6), 16);

      if (![r, g, b].every(Number.isFinite)) {
        return '';
      }

      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function renameLoadedFile(index) {
      const entry = loadedFiles[index];
      if (!entry) {
        return;
      }

      const nextName = window.prompt('Rename file label:', entry.name);
      const safeName = sanitizeFileName(nextName);
      if (!safeName) {
        return;
      }

      entry.name = safeName;
      renderLoadedFiles();
      persistState();
    }

    function recolorLoadedFile(index, color) {
      const entry = loadedFiles[index];
      if (!entry) {
        return;
      }

      entry.color = color;
      renderLoadedFiles();

      if (index === activeFileIndex && currentRawContent) {
        activeFileColor = color || '';
        renderLineChart(extractSeries(currentRawContent, selectedDescIndex));
      }

      persistState();
    }

    function clearViewer() {
      activeFileIndex = -1;
      activeFileColor = '';
      showAllFilesInChart = false;
      useStepDiagram = false;
      useDualValueChart = false;
      secondaryDescIndex = 1;
      favoriteDescIds = [];
      favoritesSortEnabled = true;
      showRawSplitView = false;
      rawViewMode = 'single';
      selectedFileIds.clear();
      currentRawContent = '';
      currentDescValues = [];
      currentDescText = 'Load a file to show DESC.';
      textArea.value = '';
      descPanel.className = '';
      descPanel.textContent = 'Load a file to show DESC.';
      descSelector.style.display = 'none';
      chartInfo.textContent = 'Load a file to generate the chart.';
      if (chartInstance) {
        chartInstance.clear();
      }
      updateViewModeButtons();
      updateRawTabView();
      updateRawEditActions();
      updateStepToggleButton();
      updateDualValueToggleButton();
      updateFavoritesSortToggleButton();
      updateDualValueControls();
      updateCompareToggleButton();
      persistState();
    }

    function renderRawSplitView() {
      if (!rawSplitView) {
        return;
      }

      rawSplitView.innerHTML = '';

      getSplitViewFiles().forEach((entry) => {
        const pane = document.createElement('section');
        pane.className = 'raw-split-pane';

        const title = document.createElement('div');
        title.className = 'raw-split-title';
        title.textContent = entry.name;

        const content = document.createElement('textarea');
        content.className = 'raw-split-content';
        content.readOnly = true;
        content.spellcheck = false;
        content.value = entry.content;

        pane.appendChild(title);
        pane.appendChild(content);
        rawSplitView.appendChild(pane);
      });
    }

    function updateRawTabView() {
      if (!textArea || !rawSplitView) {
        return;
      }

      const splitFiles = getSplitViewFiles();
      const canShowSplit = showRawSplitView && rawViewMode === 'multiple' && splitFiles.length > 1;
      if (!canShowSplit) {
        rawSplitView.classList.add('hidden');
        textArea.classList.remove('hidden');
        updateRawEditActions();
        return;
      }

      renderRawSplitView();
      textArea.classList.add('hidden');
      rawSplitView.classList.remove('hidden');
      updateRawEditActions();
    }

    function deleteLoadedFile(index) {
      const entry = loadedFiles[index];
      if (!entry) {
        return;
      }

      const confirmed = window.confirm(`Delete "${entry.name}" from loaded files?`);
      if (!confirmed) {
        return;
      }

      loadedFiles.splice(index, 1);
      selectedFileIds.delete(entry.id);

      if (entry.id === activeMetadataFileId) {
        const nextXml = loadedFiles.find((candidate) => isXmlEntry(candidate));
        if (nextXml) {
          setActiveMetadataFileId(nextXml.id);
        } else {
          activeMetadataFileId = null;
          applyMeasurementMetadata({});
        }
      }

      if (!loadedFiles.length) {
        clearViewer();
        renderLoadedFiles();
        return;
      }

      if (activeFileIndex === index) {
        const nextIndex = Math.min(index, loadedFiles.length - 1);
        setActiveFile(nextIndex);
        return;
      }

      if (activeFileIndex > index) {
        activeFileIndex -= 1;
      }

      renderLoadedFiles();
      renderLineChart();
      updateRawTabView();
      updateRawEditActions();
      persistState();
    }

    function openFileActionModal(index) {
      modalFileIndex = index;
      fileColorChoices.classList.add('hidden');
      fileActionModal.classList.remove('hidden');
      fileActionModal.setAttribute('aria-hidden', 'false');
    }

    function closeFileActionModal() {
      modalFileIndex = -1;
      fileColorChoices.classList.add('hidden');
      fileActionModal.classList.add('hidden');
      fileActionModal.setAttribute('aria-hidden', 'true');
    }

    function createFileChip(entry, index) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `file-chip${index === activeFileIndex ? ' active' : ''}`;
      chip.dataset.index = String(index);
      chip.title = entry.name;

      if (isXmlEntry(entry)) {
        chip.classList.add('file-chip-xml');
        if (entry.id === activeMetadataFileId) {
          chip.classList.add('file-chip-metadata-active');
        }
      }

      if (selectedFileIds.has(entry.id)) {
        chip.classList.add('multi-selected');
      }
      if (entry.color) {
        const fillColor = hexToRgba(entry.color, 0.2);
        const focusColor = hexToRgba(entry.color, 0.45);

        chip.classList.add('file-chip-colored');
        chip.style.borderColor = entry.color;
        if (fillColor) {
          chip.style.backgroundColor = fillColor;
        }
        if (focusColor) {
          chip.style.setProperty('--chip-focus-shadow', focusColor);
        }
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-chip-name';
      nameSpan.textContent = entry.name;

      const renameSpan = document.createElement('span');
      renameSpan.className = 'file-chip-rename';
      renameSpan.title = 'Rename';
      renameSpan.setAttribute('aria-label', `Rename ${entry.name}`);
      renameSpan.textContent = '✎';

      chip.appendChild(nameSpan);
      chip.appendChild(renameSpan);

      chip.addEventListener('click', (event) => {
        const renameTarget = event.target;
        if (renameTarget instanceof Element && renameTarget.closest('.file-chip-rename')) {
          event.stopPropagation();
          openFileActionModal(index);
          return;
        }

        if (isXmlEntry(entry)) {
          setActiveMetadataFileId(entry.id);
          renderLoadedFiles();
          persistState();
          return;
        }

        if (rawViewMode === 'multiple') {
          const wasSelected = selectedFileIds.has(entry.id);
          if (selectedFileIds.has(entry.id)) {
            selectedFileIds.delete(entry.id);
          } else {
            selectedFileIds.add(entry.id);
          }

          setActiveFile(index, {
            keepSplitView: true,
            preserveMode: true,
            syncMultiSelection: !wasSelected
          });
          updateRawTabView();
          renderLoadedFiles();
          persistState();
          return;
        }

        setActiveFile(index, { preserveMode: true });
      });

      return chip;
    }

    function appendFileGroup(title, entries) {
      if (!entries.length) {
        return;
      }

      const group = document.createElement('div');
      group.className = 'file-group';

      const groupTitle = document.createElement('div');
      groupTitle.className = 'file-group-title';
      groupTitle.textContent = title;

      const chipRow = document.createElement('div');
      chipRow.className = 'file-group-chips';

      entries.forEach(({ entry, index }) => {
        chipRow.appendChild(createFileChip(entry, index));
      });

      group.appendChild(groupTitle);
      group.appendChild(chipRow);
      loadedFilesEl.appendChild(group);
    }

    function renderLoadedFiles() {
      loadedFilesEl.innerHTML = '';

      const upfEntries = [];
      const xmlEntries = [];

      loadedFiles.forEach((entry, index) => {
        if (isXmlEntry(entry)) {
          xmlEntries.push({ entry, index });
        } else {
          upfEntries.push({ entry, index });
        }
      });

      appendFileGroup('UPF Files', upfEntries);
      appendFileGroup('XML Files', xmlEntries);
    }

    function setActiveFile(index, options = {}) {
      const keepSplitView = Boolean(options.keepSplitView);
      const preserveMode = Boolean(options.preserveMode);
      const syncMultiSelection = options.syncMultiSelection !== false;
      const selectedFile = loadedFiles[index];
      if (!selectedFile) {
        return;
      }

      activeFileIndex = index;
      activeFileColor = selectedFile.color || '';
      currentRawContent = selectedFile.content;
      textArea.value = selectedFile.content;
      if (!keepSplitView) {
        showRawSplitView = rawViewMode === 'multiple';
      }
      if (!preserveMode) {
        rawViewMode = 'single';
      }
      if (rawViewMode === 'multiple' && syncMultiSelection) {
        selectedFileIds.add(selectedFile.id);
      }
      formatDesc(extractDesc(selectedFile.content));
      renderLineChart();
      updateViewModeButtons();
      renderLoadedFiles();
      updateRawTabView();
      updateRawEditActions();
      persistState();
    }

    function switchTab(tabName) {
      tabButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      tabPanels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
      });

      if (tabName === 'chart' && chartInstance) {
        requestAnimationFrame(() => chartInstance.resize());
      }
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    function extractDesc(content) {
      const descMatch = content.match(/<DESC>([\s\S]*?)<MD\b/i);

      if (descMatch && descMatch[1]) {
        return descMatch[1].trim();
      }

      const genericDescMatch = content.match(/<DESC>([\s\S]*?)<\/DESC>/i);
      return genericDescMatch && genericDescMatch[1] ? genericDescMatch[1].trim() : 'DESC not found.';
    }

    function formatDesc(rawDesc) {
      if (!rawDesc || rawDesc === 'DESC not found.') {
        currentDescValues = [];
        currentThingValueType = '';
        currentDescText = rawDesc || 'DESC not found.';
        return currentDescText;
      }

      const values = rawDesc
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      if (!values.length) {
        currentDescValues = [];
        currentThingValueType = '';
        currentDescText = 'DESC not found.';
        return currentDescText;
      }

      const thingValueType = values[0];
      const descValues = values.slice(1);
      currentThingValueType = thingValueType;
      currentDescValues = descValues;
      selectedDescIndex = 0;
      secondaryDescIndex = descValues.length > 1 ? 1 : 0;

      currentDescText = [
        `Thing value type: ${thingValueType}`,
        'Values:',
        descValues.join('\n')
      ].join('\n');

      populateDescSelector(descValues);

      return currentDescText;
    }

    function highlightSearchMatches(text, query) {
      if (!query) return text;
      
      try {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        const parts = text.split(regex);
        
        return parts.map((part, i) => {
          if (i % 2 === 1) {
            // Odd indices are the matches - wrap in span
            return `<span class="desc-search-match">${part}</span>`;
          }
          return part;
        }).join('');
      } catch (e) {
        return text;
      }
    }

    function getFilteredDescIndexes() {
      const query = (descSearchInput ? descSearchInput.value : '').trim().toLowerCase();
      const filteredIndexes = [];

      currentDescValues.forEach((value, index) => {
        const readableName = getMeasurementName(value);
        const lookupText = `${value} ${readableName}`.toLowerCase();
        if (!query || lookupText.includes(query)) {
          filteredIndexes.push(index);
        }
      });

      return filteredIndexes;
    }

    function getDescLabelByIndex(index) {
      const rawId = currentDescValues[index];
      if (typeof rawId === 'undefined') {
        return `Value ${index + 1}`;
      }

      const readableName = getMeasurementName(rawId);
      return readableName !== rawId ? `${readableName} (ID: ${rawId})` : rawId;
    }

    function normalizeFavoriteDescIds() {
      const availableIds = new Set(currentDescValues.map((value) => String(value)));
      const deduped = [];
      const seen = new Set();

      favoriteDescIds.forEach((id) => {
        const key = String(id);
        if (!availableIds.has(key) || seen.has(key)) {
          return;
        }

        seen.add(key);
        deduped.push(key);
      });

      favoriteDescIds = deduped;
    }

    function getSortedDescIndexes(filteredIndexes) {
      if (!favoritesSortEnabled) {
        return [...filteredIndexes];
      }

      normalizeFavoriteDescIds();
      const favoritePos = new Map(favoriteDescIds.map((id, position) => [id, position]));

      return [...filteredIndexes].sort((a, b) => {
        const idA = String(currentDescValues[a]);
        const idB = String(currentDescValues[b]);
        const posA = favoritePos.get(idA);
        const posB = favoritePos.get(idB);
        const isFavA = Number.isInteger(posA);
        const isFavB = Number.isInteger(posB);

        if (isFavA && isFavB) {
          return posA - posB;
        }

        if (isFavA) {
          return -1;
        }

        if (isFavB) {
          return 1;
        }

        return a - b;
      });
    }

    function toggleFavoriteByIndex(index) {
      const rawId = String(currentDescValues[index]);
      const existingPos = favoriteDescIds.indexOf(rawId);

      if (existingPos >= 0) {
        favoriteDescIds.splice(existingPos, 1);
      } else {
        favoriteDescIds.push(rawId);
      }

      updateDescDisplay();
      persistState();
    }

    function updateFavoritesSortToggleButton() {
      if (!favoritesSortToggleBtn) {
        return;
      }

      favoritesSortToggleBtn.textContent = favoritesSortEnabled ? 'Favorites Order: ON' : 'Favorites Order: OFF';
      favoritesSortToggleBtn.classList.toggle('active', favoritesSortEnabled);
    }

    function moveFavoriteBefore(draggedRawId, targetRawId) {
      if (!draggedRawId || !targetRawId || draggedRawId === targetRawId) {
        return;
      }

      const sourcePos = favoriteDescIds.indexOf(draggedRawId);
      const targetPos = favoriteDescIds.indexOf(targetRawId);
      if (sourcePos < 0 || targetPos < 0) {
        return;
      }

      favoriteDescIds.splice(sourcePos, 1);
      const adjustedTargetPos = sourcePos < targetPos ? targetPos - 1 : targetPos;
      favoriteDescIds.splice(adjustedTargetPos, 0, draggedRawId);
      updateDescDisplay();
      persistState();
    }

    function updateDualValueToggleButton() {
      if (!dualValueToggleBtn) {
        return;
      }

      dualValueToggleBtn.textContent = useDualValueChart ? 'Dual Axis: ON' : 'Dual Axis: OFF';
      dualValueToggleBtn.classList.toggle('active', useDualValueChart);
      dualValueToggleBtn.disabled = currentDescValues.length < 2 || showAllFilesInChart;
    }

    function ensureDistinctDescIndexes() {
      if (!useDualValueChart || currentDescValues.length < 2) {
        return;
      }

      if (secondaryDescIndex !== selectedDescIndex) {
        return;
      }

      const fallbackIndex = selectedDescIndex === 0 ? 1 : 0;
      secondaryDescIndex = fallbackIndex < currentDescValues.length ? fallbackIndex : selectedDescIndex;
    }

    function selectSecondaryDescValue(index) {
      if (useDualValueChart && !showAllFilesInChart) {
        if (index === selectedDescIndex) {
          const previousLeft = selectedDescIndex;
          selectedDescIndex = secondaryDescIndex;
          secondaryDescIndex = previousLeft;
        } else {
          secondaryDescIndex = index;
        }
      } else {
        secondaryDescIndex = index;
      }

      ensureDistinctDescIndexes();
      updateDescDisplay();
      updateDualValueControls();
      renderLineChart();
      persistState();
    }

    function updateDualValueControls() {
      const canUseDual = currentDescValues.length > 1;

      if (!canUseDual) {
        useDualValueChart = false;
      }

      ensureDistinctDescIndexes();
      updateDualValueToggleButton();
    }


    function populateDescSelector(descValuesArray) {
      // Show/hide selector based on values
      if (descValuesArray.length > 0) {
        descSelector.style.display = 'block';
        updateDualValueControls();
        updateDescDisplay();
      } else {
        descSelector.style.display = 'none';
        updateDualValueControls();
      }
    }

    function updateDescDisplay() {
      const filteredIndexes = getSortedDescIndexes(getFilteredDescIndexes());
      const showDualActions = useDualValueChart && !showAllFilesInChart && currentDescValues.length > 1;

      if (!filteredIndexes.length) {
        descPanel.className = 'desc-mode';
        descPanel.textContent = 'No DESC values match the search.';
        return;
      }

      if (useListView) {
        // List mode: show clickable items in descPanel
        descPanel.innerHTML = '';
        descPanel.className = 'list-mode';

        const query = (descSearchInput ? descSearchInput.value : '').trim().toLowerCase();

        filteredIndexes.forEach((index) => {
          const value = currentDescValues[index];
          const rawId = String(value);
          const isFavorite = favoriteDescIds.includes(rawId);
          const item = document.createElement('div');
          item.className = 'desc-value-item';
          const readableName = getMeasurementName(value);
          const displayText = readableName !== value ? `${readableName} (ID: ${value})` : value;
          const highlightedHtml = highlightSearchMatches(displayText, query);
          item.innerHTML = highlightedHtml;
          item.dataset.index = index;

          if (index === selectedDescIndex) {
            item.classList.add('selected');
          }

          if (showDualActions && index === secondaryDescIndex) {
            item.classList.add('secondary-selected');
          }

          if (isFavorite) {
            item.classList.add('favorite-selected');

            const dragHandle = document.createElement('button');
            dragHandle.type = 'button';
            dragHandle.className = 'desc-drag-handle';
            dragHandle.textContent = '⋮⋮';
            dragHandle.title = 'Drag to reorder favorites';
            dragHandle.draggable = true;

            dragHandle.addEventListener('click', (event) => {
              event.stopPropagation();
            });

            dragHandle.addEventListener('dragstart', (event) => {
              event.stopPropagation();
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', rawId);
              }
              item.classList.add('drag-source');
            });

            dragHandle.addEventListener('dragend', () => {
              item.classList.remove('drag-source');
              document.querySelectorAll('.desc-value-item.drag-target').forEach((el) => {
                el.classList.remove('drag-target');
              });
            });

            item.prepend(dragHandle);

            item.addEventListener('dragover', (event) => {
              event.preventDefault();
              item.classList.add('drag-target');
            });

            item.addEventListener('dragleave', () => {
              item.classList.remove('drag-target');
            });

            item.addEventListener('drop', (event) => {
              event.preventDefault();
              item.classList.remove('drag-target');
              const draggedRawId = event.dataTransfer ? event.dataTransfer.getData('text/plain') : '';
              moveFavoriteBefore(draggedRawId, rawId);
            });
          }

          const favoriteActions = document.createElement('div');
          favoriteActions.className = 'desc-favorite-actions';

          const favoriteBtn = document.createElement('button');
          favoriteBtn.type = 'button';
          favoriteBtn.className = `desc-favorite-btn${isFavorite ? ' active' : ''}`;
          favoriteBtn.textContent = isFavorite ? '★' : '☆';
          favoriteBtn.title = isFavorite ? 'Remove favorite' : 'Add favorite';
          favoriteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleFavoriteByIndex(index);
          });
          favoriteActions.appendChild(favoriteBtn);

          item.appendChild(favoriteActions);

          if (showDualActions) {
            const axisActions = document.createElement('div');
            axisActions.className = 'desc-axis-actions';

            const leftBtn = document.createElement('button');
            leftBtn.type = 'button';
            leftBtn.className = `desc-axis-btn${index === selectedDescIndex ? ' active' : ''}`;
            leftBtn.textContent = 'Left';
            leftBtn.addEventListener('click', (event) => {
              event.stopPropagation();
              selectDescValue(index);
            });

            const rightBtn = document.createElement('button');
            rightBtn.type = 'button';
            rightBtn.className = `desc-axis-btn desc-axis-btn-right${index === secondaryDescIndex ? ' active' : ''}`;
            rightBtn.textContent = 'Right';
            rightBtn.addEventListener('click', (event) => {
              event.stopPropagation();
              selectSecondaryDescValue(index);
            });

            axisActions.appendChild(leftBtn);
            axisActions.appendChild(rightBtn);
            item.appendChild(axisActions);
          }

          item.addEventListener('click', () => {
            selectDescValue(index);
          });

          descPanel.appendChild(item);
        });
      } else {
        // Description mode: show DESC text with highlighted selected value
        descPanel.className = 'desc-mode';
        descPanel.innerHTML = '';

        const typeLine = document.createElement('div');
        typeLine.textContent = `Thing value type: ${currentThingValueType}`;
        descPanel.appendChild(typeLine);

        const valuesLine = document.createElement('div');
        valuesLine.textContent = 'Values:';
        descPanel.appendChild(valuesLine);

        const query = (descSearchInput ? descSearchInput.value : '').trim().toLowerCase();

        filteredIndexes.forEach((index) => {
          const rawId = currentDescValues[index];
          const lineDiv = document.createElement('div');

          const readableName = getMeasurementName(rawId);
          const displayText = readableName !== rawId ? `${readableName} (ID: ${rawId})` : rawId;
          const valueSpan = document.createElement('span');
          const highlightedHtml = highlightSearchMatches(displayText, query);
          valueSpan.innerHTML = highlightedHtml;

          if (index === selectedDescIndex) {
            valueSpan.classList.add('selected');
          }

          lineDiv.appendChild(valueSpan);
          descPanel.appendChild(lineDiv);
        });
      }
    }

    function selectDescValue(index) {
      if (useDualValueChart && !showAllFilesInChart) {
        if (index === secondaryDescIndex) {
          const previousLeft = selectedDescIndex;
          selectedDescIndex = secondaryDescIndex;
          secondaryDescIndex = previousLeft;
        } else {
          selectedDescIndex = index;
        }
      } else {
        selectedDescIndex = index;
      }

      ensureDistinctDescIndexes();
      updateDescDisplay();
      updateDualValueControls();
      renderLineChart();
      persistState();
    }

    function extractSeries(content, descIndex = 0) {
      const mdRegex = /<MD\b[^>]*T="([^"]+)"[^>]*>([^<]*)<\/MD>/g;
      const points = [];
      let match;

      while ((match = mdRegex.exec(content)) !== null) {
        const timestamp = match[1];
        const values = (match[2] || '').split(',').map((v) => Number.parseFloat(v.trim()));
        const value = values[descIndex];

        if (Number.isFinite(value)) {
          points.push({ timestamp, value });
        }
      }

      return points;
    }

    function renderLineChart() {
      let series = [];
      let sampleCount = 0;
      const showDualAxes = useDualValueChart && !showAllFilesInChart && currentDescValues.length > 1;

      ensureDistinctDescIndexes();

      if (showAllFilesInChart) {
        series = loadedFiles
          .map((entry, index) => {
            const points = extractSeries(entry.content, selectedDescIndex);
            sampleCount += points.length;
            return {
              name: entry.name,
              points,
              color: getSeriesColor(entry, index)
            };
          })
          .filter((s) => s.points.length > 0);
      } else {
        const activeEntry = loadedFiles[activeFileIndex];
        const primaryPoints = extractSeries(currentRawContent, selectedDescIndex);
        sampleCount = primaryPoints.length;

        if (showDualAxes) {
          const secondaryPoints = extractSeries(currentRawContent, secondaryDescIndex);
          sampleCount += secondaryPoints.length;

          if (primaryPoints.length) {
            series.push({
              name: `${getDescLabelByIndex(selectedDescIndex)} (LEFT)`,
              points: primaryPoints,
              color: activeFileColor || '#0f766e',
              yAxisIndex: 0
            });
          }

          if (secondaryPoints.length) {
            series.push({
              name: `${getDescLabelByIndex(secondaryDescIndex)} (RIGHT)`,
              points: secondaryPoints,
              color: '#dc2626',
              yAxisIndex: 1
            });
          }
        } else if (primaryPoints.length) {
          series = [
            {
              name: activeEntry ? activeEntry.name : 'Active File',
              points: primaryPoints,
              color: activeFileColor || '#0f766e',
              yAxisIndex: 0
            }
          ];
        }
      }

      if (!series.length) {
        chartInfo.textContent = 'No MD chart data found in this file.';
        if (chartInstance) {
          chartInstance.clear();
        }
        return;
      }

      if (typeof window.echarts === 'undefined') {
        chartInfo.textContent = 'ECharts failed to load. Please check your network and reload.';
        return;
      }

      const allValues = series.flatMap((s) => s.points.map((p) => p.value));
      const values = allValues;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const leftAxisColor = showDualAxes ? (activeFileColor || '#0f766e') : '#6b7280';
      const rightAxisColor = '#dc2626';

      if (!chartInstance) {
        chartInstance = window.echarts.init(chartArea);
      }

      chartInstance.setOption({
        animation: true,
        grid: {
          left: 60,
          right: 24,
          top: 24,
          bottom: 42
        },
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: 0,
            filterMode: 'none',
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
            preventDefaultMouseMove: false
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            height: 20,
            bottom: 8,
            borderColor: '#d1d5db'
          }
        ],
        tooltip: {
          trigger: 'axis',
          valueFormatter: (value) => Number(value).toFixed(3)
        },
        legend: {
          show: showAllFilesInChart || showDualAxes,
          top: 2,
          textStyle: {
            color: '#6b7280'
          }
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            color: '#6b7280',
            hideOverlap: true
          },
          axisLine: {
            lineStyle: {
              color: '#d1d5db'
            }
          }
        },
        yAxis: showDualAxes
          ? [
              {
                type: 'value',
                position: 'left',
                axisLabel: {
                  color: leftAxisColor
                },
                axisLine: {
                  show: true,
                  lineStyle: {
                    color: leftAxisColor
                  }
                },
                splitLine: {
                  lineStyle: {
                    color: '#e5e7eb'
                  }
                }
              },
              {
                type: 'value',
                position: 'right',
                axisLabel: {
                  color: rightAxisColor
                },
                axisLine: {
                  show: true,
                  lineStyle: {
                    color: rightAxisColor
                  }
                },
                splitLine: {
                  show: false
                }
              }
            ]
          : {
              type: 'value',
              axisLabel: {
                color: '#6b7280'
              },
              splitLine: {
                lineStyle: {
                  color: '#e5e7eb'
                }
              }
            },
        series: [
          ...series.map((entry, index) => ({
            name: entry.name,
            type: 'line',
            smooth: 0.2,
            step: useStepDiagram ? 'end' : false,
            showSymbol: false,
            yAxisIndex: Number.isInteger(entry.yAxisIndex) ? entry.yAxisIndex : 0,
            lineStyle: {
              color: entry.color,
              width: 2
            },
            data: entry.points.map((p) => [p.timestamp, p.value])
          }))
        ]
      }, { notMerge: true });

      chartInstance.resize();

      if (showAllFilesInChart) {
        chartInfo.textContent = `Series: ${series.length} | Samples: ${sampleCount} | Min: ${min.toFixed(3)} | Max: ${max.toFixed(3)} | Mouse wheel: zoom X`;
      } else if (showDualAxes) {
        chartInfo.textContent = `Series: ${series.length} | Samples: ${sampleCount} | Min: ${min.toFixed(3)} | Max: ${max.toFixed(3)} | Left/Right Y-axis active | Mouse wheel: zoom X`;
      } else {
        const last = series[0].points[series[0].points.length - 1];
        chartInfo.textContent = `Samples: ${series[0].points.length} | Min: ${min.toFixed(3)} | Max: ${max.toFixed(3)} | Last (${last.timestamp}): ${last.value.toFixed(3)} | Mouse wheel: zoom X`;
      }
    }

    const resizeChart = () => {
      if (chartInstance) {
        chartInstance.resize();
      }
    };

    window.addEventListener('resize', resizeChart);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(resizeChart);
      observer.observe(chartArea);
      if (chartCard) {
        observer.observe(chartCard);
      }
    }

    // Click on button → trigger hidden file input
    loadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    if (descSearchInput) {
      descSearchInput.addEventListener('input', () => {
        if (!currentDescValues.length) {
          return;
        }

        populateDescSelector(currentDescValues);
      });
    }

    compareToggleBtn.addEventListener('click', () => {
      showAllFilesInChart = !showAllFilesInChart;
      updateCompareToggleButton();
      updateDualValueControls();
      renderLineChart();
      persistState();
    });

    if (favoritesSortToggleBtn) {
      favoritesSortToggleBtn.addEventListener('click', () => {
        favoritesSortEnabled = !favoritesSortEnabled;
        updateFavoritesSortToggleButton();
        updateDescDisplay();
        persistState();
      });
    }

    if (dualValueToggleBtn) {
      dualValueToggleBtn.addEventListener('click', () => {
        if (currentDescValues.length < 2) {
          return;
        }

        useDualValueChart = !useDualValueChart;
        if (useDualValueChart) {
          useListView = true;
        }
        ensureDistinctDescIndexes();
        updateDualValueToggleButton();
        updateDualValueControls();
        updateDescDisplay();
        renderLineChart();
        persistState();
      });
    }

    if (stepToggleBtn) {
      stepToggleBtn.addEventListener('click', () => {
        useStepDiagram = !useStepDiagram;
        updateStepToggleButton();
        renderLineChart();
        persistState();
      });
    }

    if (singleViewBtn) {
      singleViewBtn.addEventListener('click', () => {
        setRawViewMode('single');
      });
    }

    if (multiViewBtn) {
      multiViewBtn.addEventListener('click', () => {
        if (activeFileIndex >= 0 && loadedFiles[activeFileIndex]) {
          selectedFileIds.add(loadedFiles[activeFileIndex].id);
        }
        setRawViewMode('multiple');
      });
    }

    if (textArea) {
      textArea.addEventListener('input', () => {
        updateRawEditActions();
      });

      textArea.addEventListener('paste', (event) => {
        const hasActiveFile = activeFileIndex >= 0 && Boolean(loadedFiles[activeFileIndex]);
        const isBlankEditor = !hasActiveFile && !textArea.value.trim();
        if (!isBlankEditor) {
          return;
        }

        const pastedText = event.clipboardData ? event.clipboardData.getData('text') : '';
        if (!pastedText) {
          return;
        }

        event.preventDefault();
        const createdEntry = createNewFileFromEditor(pastedText, 'pasted_file.upf2');
        if (!createdEntry) {
          return;
        }

        textArea.value = createdEntry.content;
        updateRawEditActions();
      });
    }

    if (keepEditedFileBtn) {
      keepEditedFileBtn.addEventListener('click', () => {
        const activeEntry = loadedFiles[activeFileIndex];
        if (!activeEntry) {
          return;
        }

        activeEntry.content = textArea.value;
        currentRawContent = activeEntry.content;
        textArea.value = activeEntry.content;
        formatDesc(extractDesc(activeEntry.content));
        renderLineChart();
        updateRawEditActions();
        persistState();
      });
    }

    if (createEditedFileBtn) {
      createEditedFileBtn.addEventListener('click', () => {
        const content = textArea.value;
        const activeEntry = loadedFiles[activeFileIndex];
        const defaultName = activeEntry ? `${activeEntry.name}_copy.upf2` : 'new_file.upf2';
        const createdEntry = createNewFileFromEditor(content, defaultName);
        if (!createdEntry) {
          return;
        }

        setRawViewMode('single');
        textArea.value = createdEntry.content;
        updateRawEditActions();
      });
    }

    if (discardEditedFileBtn) {
      discardEditedFileBtn.addEventListener('click', () => {
        const activeEntry = loadedFiles[activeFileIndex];
        textArea.value = activeEntry ? activeEntry.content : '';
        updateRawEditActions();
      });
    }

    // F2 rename for focused file chip
    loadedFilesEl.addEventListener('keydown', (event) => {
      if (event.key !== 'F2') {
        return;
      }

      const activeElement = document.activeElement;
      if (!(activeElement instanceof Element)) {
        return;
      }

      const focusedChip = activeElement.closest('.file-chip');
      if (!focusedChip || !loadedFilesEl.contains(focusedChip)) {
        return;
      }

      const index = Number.parseInt(focusedChip.dataset.index || '', 10);
      if (!Number.isInteger(index)) {
        return;
      }

      event.preventDefault();
      renameLoadedFile(index);
    });

    actionRenameBtn.addEventListener('click', () => {
      if (modalFileIndex < 0) {
        return;
      }
      renameLoadedFile(modalFileIndex);
      closeFileActionModal();
    });

    actionRecolorBtn.addEventListener('click', () => {
      fileColorChoices.classList.remove('hidden');
    });

    actionDeleteBtn.addEventListener('click', () => {
      if (modalFileIndex < 0) {
        return;
      }

      deleteLoadedFile(modalFileIndex);
      closeFileActionModal();
    });

    colorChoiceButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (modalFileIndex < 0) {
          return;
        }

        const color = btn.getAttribute('data-color') || '';
        recolorLoadedFile(modalFileIndex, color);
        closeFileActionModal();
      });
    });

    actionCloseBtn.addEventListener('click', closeFileActionModal);
    fileActionModal.addEventListener('click', (event) => {
      if (event.target === fileActionModal) {
        closeFileActionModal();
      }
    });

    // F2 fallback: rename currently active file unless typing in an input control
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'F2') {
        return;
      }

      const activeElement = document.activeElement;
      const isTypingTarget = activeElement instanceof HTMLInputElement
        || activeElement instanceof HTMLTextAreaElement
        || (activeElement instanceof Element && activeElement.isContentEditable);

      if (isTypingTarget) {
        return;
      }

      if (activeFileIndex < 0 || !loadedFiles[activeFileIndex]) {
        return;
      }

      event.preventDefault();
      renameLoadedFile(activeFileIndex);
    });

    // Delete key: delete currently active file unless typing in an input control
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Delete') {
        return;
      }

      const activeElement = document.activeElement;
      const isTypingTarget = activeElement instanceof HTMLInputElement
        || activeElement instanceof HTMLTextAreaElement
        || (activeElement instanceof Element && activeElement.isContentEditable);

      if (isTypingTarget) {
        return;
      }

      if (activeFileIndex < 0 || !loadedFiles[activeFileIndex]) {
        return;
      }

      event.preventDefault();
      deleteLoadedFile(activeFileIndex);
    });

    updateStepToggleButton();
    updateCompareToggleButton();
    updateFavoritesSortToggleButton();
    updateViewModeButtons();
    loadMeasurementMetadata();
    restoreState();

    // When user selects a file
    fileInput.addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []);

      if (!files.length) return;

      try {
        const entries = await Promise.all(
          files.map(async (file) => ({
            id: `${file.name}_${file.size}_${file.lastModified}`,
            name: file.name,
            color: '',
            content: await readFileAsText(file),
            kind: getFileKind(file.name)
          }))
        );

        const addedIds = [];
        entries.forEach((entry) => {
          if (!loadedFiles.some((existing) => existing.id === entry.id)) {
            loadedFiles.push(entry);
            addedIds.push(entry.id);
          }
        });

        if (activeFileIndex === -1 && loadedFiles.length > 0) {
          setActiveFile(0);
        } else {
          const firstAddedId = addedIds[0];
          if (firstAddedId) {
            const newIndex = loadedFiles.findIndex((f) => f.id === firstAddedId);
            setActiveFile(newIndex);
          }
        }

        renderLoadedFiles();
        fileInput.value = '';
        persistState();
      } catch (error) {
        alert('Error reading file(s). Please try again.');
      }
    });