  const loadBtn = document.getElementById('loadBtn');
    const fileInput = document.getElementById('fileInput');
    const textArea = document.getElementById('textArea');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const descPanel = document.getElementById('descPanel');
    const chartArea = document.getElementById('chartArea');
    const chartCard = document.querySelector('.chart-card');
    const chartInfo = document.getElementById('chartInfo');
    const descSelector = document.getElementById('descSelector');
    const descValueSelect = document.getElementById('descValueSelect');
    const selectorToggleBtn = document.getElementById('selectorToggleBtn');
    const loadedFilesEl = document.getElementById('loadedFiles');
    let chartInstance = null;
    let currentDescValues = [];
    let currentRawContent = '';
    let selectedDescIndex = 0;
    let useListView = false;
    let currentDescText = '';
    let loadedFiles = [];
    let activeFileIndex = -1;

    function readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result || '');
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsText(file);
      });
    }

    function sanitizeFileName(name) {
      const cleaned = (name || '').trim();
      return cleaned.length ? cleaned : null;
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
    }

    function renderLoadedFiles() {
      loadedFilesEl.innerHTML = '';

      loadedFiles.forEach((entry, index) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `file-chip${index === activeFileIndex ? ' active' : ''}`;
        chip.dataset.index = String(index);
        chip.title = entry.name;

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
            renameLoadedFile(index);
            return;
          }

          setActiveFile(index);
        });

        loadedFilesEl.appendChild(chip);
      });
    }

    function setActiveFile(index) {
      const selectedFile = loadedFiles[index];
      if (!selectedFile) {
        return;
      }

      activeFileIndex = index;
      currentRawContent = selectedFile.content;
      textArea.value = selectedFile.content;
      formatDesc(extractDesc(selectedFile.content));
      renderLineChart(extractSeries(selectedFile.content, selectedDescIndex));
      renderLoadedFiles();
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
        currentDescText = rawDesc || 'DESC not found.';
        return currentDescText;
      }

      const values = rawDesc
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      if (!values.length) {
        currentDescValues = [];
        currentDescText = 'DESC not found.';
        return currentDescText;
      }

      const thingValueType = values[0];
      const descValues = values.slice(1);
      currentDescValues = descValues;
      selectedDescIndex = 0;

      currentDescText = [
        `Thing value type: ${thingValueType}`,
        'Values:',
        descValues.join('\n')
      ].join('\n');

      populateDescSelector(descValues);

      return currentDescText;
    }


    function populateDescSelector(descValuesArray) {
      // Always populate dropdown
      descValueSelect.innerHTML = '';
      descValuesArray.forEach((value, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = value;
        descValueSelect.appendChild(option);
      });

      // Show/hide selector based on values
      if (descValuesArray.length > 0) {
        descSelector.style.display = 'block';
        updateDescDisplay();
      } else {
        descSelector.style.display = 'none';
      }
    }

    function updateDescDisplay() {
      // Update dropdown selection
      descValueSelect.value = selectedDescIndex;

      if (useListView) {
        // List mode: show clickable items in descPanel
        descPanel.innerHTML = '';
        descPanel.className = 'list-mode';

        currentDescValues.forEach((value, index) => {
          const item = document.createElement('div');
          item.className = 'desc-value-item';
          item.textContent = value;
          item.dataset.index = index;

          if (index === selectedDescIndex) {
            item.classList.add('selected');
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

        // Parse and display the DESC text with highlighting
        const lines = currentDescText.split('\n');
        lines.forEach((line, lineIndex) => {
          const lineDiv = document.createElement('div');

          // Check if this line is a DESC value that should be highlighted
          const valueIndex = currentDescValues.findIndex(v => line.trim() === v);
          
          if (valueIndex !== -1) {
            // This is a DESC value - create a span for it
            const valueSpan = document.createElement('span');
            valueSpan.textContent = line.trim();
            
            if (valueIndex === selectedDescIndex) {
              valueSpan.classList.add('selected');
            }

            lineDiv.appendChild(valueSpan);
          } else {
            // This is a header line like "Thing value type:" or "Values:"
            lineDiv.textContent = line;
          }

          descPanel.appendChild(lineDiv);
        });
      }
    }

    function selectDescValue(index) {
      selectedDescIndex = index;
      updateDescDisplay();
      renderLineChart(extractSeries(currentRawContent, selectedDescIndex));
    }

    function toggleSelectorView() {
      useListView = !useListView;
      selectorToggleBtn.textContent = useListView ? '≡' : '⊞';
      updateDescDisplay();
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

    function renderLineChart(points) {
      if (!points.length) {
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

      const values = points.map((p) => p.value);
      const min = Math.min(...values);
      const max = Math.max(...values);

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
        xAxis: {
          type: 'category',
          data: points.map((p) => p.timestamp),
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
        yAxis: {
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
          {
            name: 'First MD Value',
            type: 'line',
            smooth: 0.2,
            showSymbol: false,
            lineStyle: {
              color: '#0f766e',
              width: 2
            },
            areaStyle: {
              color: 'rgba(15, 118, 110, 0.10)'
            },
            data: points.map((p) => p.value)
          }
        ]
      });

      chartInstance.resize();

      const last = points[points.length - 1];
      chartInfo.textContent = `Samples: ${points.length} | Min: ${min.toFixed(3)} | Max: ${max.toFixed(3)} | Last (${last.timestamp}): ${last.value.toFixed(3)} | Mouse wheel: zoom X`;
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

    // When user selects a DESC value to visualize via dropdown
    descValueSelect.addEventListener('change', (event) => {
      selectDescValue(Number.parseInt(event.target.value, 10));
    });

    // Toggle selector view
    selectorToggleBtn.addEventListener('click', toggleSelectorView);

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

    // When user selects a file
    fileInput.addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []);

      if (!files.length) return;

      try {
        const entries = await Promise.all(
          files.map(async (file) => ({
            id: `${file.name}_${file.size}_${file.lastModified}`,
            name: file.name,
            content: await readFileAsText(file)
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
      } catch (error) {
        alert('Error reading file(s). Please try again.');
      }
    });