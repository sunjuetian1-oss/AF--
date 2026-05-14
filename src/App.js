import React, { useState, useCallback } from 'react';
import { analyzeData, MEDIA_DISPLAY } from './utils/parseData';
import './App.css';

// 优先展示的媒体顺序（其余媒体自动追加在后面）
const PRIORITY_TABS = ['overall', 'organic', 'Facebook Ads', 'googleadwords_int', 'Apple Search Ads', 'tiktokglobal_int'];

function formatPct(val) {
  if (val === null || val === undefined) return '—';
  return (val * 100).toFixed(1) + '%';
}

function formatDiff(val) {
  if (val === null || val === undefined) return '—';
  const pct = (val * 100).toFixed(1);
  return (val >= 0 ? '+' : '') + pct + '%';
}

function formatUsers(val) {
  if (val === null || val === undefined) return '—';
  return val.toLocaleString();
}

function UploadBox({ yesterdayFile, sevenDayFile, onFilesChange }) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((files) => {
    const arr = Array.from(files);
    if (arr.length >= 2) {
      onFilesChange(arr[0], arr[1]);
    } else if (arr.length === 1) {
      onFilesChange(arr[0], null);
    }
  }, [onFilesChange]);

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const bothReady = yesterdayFile && sevenDayFile;

  return (
    <div
      className={`upload-box single ${dragging ? 'dragging' : ''} ${bothReady ? 'has-file' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById('input-files').click()}
    >
      <input
        id="input-files"
        type="file"
        accept=".csv"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
      <div className="upload-icon">{bothReady ? '✓' : '↑'}</div>
      <div className="upload-label">
        {bothReady ? '已选择 2 个文件' : '上传昨日 + 过去7日的 CSV 文件'}
      </div>
      <div className="upload-files-list">
        {yesterdayFile
          ? <div className="file-tag file-tag-blue">📄 昨日：{yesterdayFile.name}</div>
          : <div className="file-tag file-tag-empty">昨日数据（第1个文件）</div>
        }
        {sevenDayFile
          ? <div className="file-tag file-tag-purple">📄 7日：{sevenDayFile.name}</div>
          : <div className="file-tag file-tag-empty">7日数据（第2个文件）</div>
        }
      </div>
      <div className="upload-hint-inline">同时选中两个 CSV 文件即可</div>
    </div>
  );
}

function SummaryBar({ data }) {
  const overall = data['overall'];
  if (!overall) return null;

  const anomalyCount = overall.rows.filter(r => r.isAnomaly).length;
  const totalEvents = overall.rows.length;

  return (
    <div className="summary-bar">
      <div className="summary-item">
        <span className="summary-num">{totalEvents}</span>
        <span className="summary-desc">事件总数</span>
      </div>
      <div className={`summary-item ${anomalyCount > 0 ? 'anomaly' : 'ok'}`}>
        <span className="summary-num">{anomalyCount}</span>
        <span className="summary-desc">异常事件</span>
      </div>
      <div className="summary-item">
        <span className="summary-num">{formatUsers(overall.yActive)}</span>
        <span className="summary-desc">昨日 Active 用户</span>
      </div>
      <div className="summary-item">
        <span className="summary-num">{formatUsers(overall.sActive)}</span>
        <span className="summary-desc">7日 Active 用户</span>
      </div>
    </div>
  );
}

function EventTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="empty">该媒体无数据</div>;
  }

  return (
    <div className="table-wrap">
      <table className="event-table">
        <thead>
          <tr>
            <th className="col-event">事件名称</th>
            <th>昨日用户数</th>
            <th>昨日转化率</th>
            <th>7日用户数</th>
            <th>7日转化率</th>
            <th>变化幅度</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.event} className={row.isAnomaly ? 'row-anomaly' : ''}>
              <td className="col-event">
                <span className="event-name">{row.event}</span>
              </td>
              <td>{formatUsers(row.yUsers)}</td>
              <td className={row.isAnomaly ? 'pct-anomaly' : ''}>{formatPct(row.yRatio)}</td>
              <td>{formatUsers(row.sUsers)}</td>
              <td>{formatPct(row.sRatio)}</td>
              <td className={`diff-cell ${row.diff !== null ? (row.diff >= 0 ? 'diff-up' : 'diff-down') : ''}`}>
                {formatDiff(row.diff)}
              </td>
              <td>
                {row.isAnomaly
                  ? <span className="badge badge-anomaly">⚠ 异常</span>
                  : row.diff !== null
                    ? <span className="badge badge-ok">正常</span>
                    : <span className="badge badge-na">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [yesterdayFile, setYesterdayFile] = useState(null);
  const [sevenDayFile, setSevenDayFile] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overall');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFilesChange = useCallback((f1, f2) => {
    setYesterdayFile(f1);
    setSevenDayFile(f2);
  }, []);

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });

  const handleAnalyze = async () => {
    if (!yesterdayFile || !sevenDayFile) return;
    setLoading(true);
    setError(null);
    try {
      const [yText, sText] = await Promise.all([
        readFile(yesterdayFile),
        readFile(sevenDayFile),
      ]);
      const data = analyzeData(yText, sText);
      setResult(data);
      setActiveTab('overall');
    } catch (e) {
      setError('解析失败，请检查 CSV 文件格式是否正确');
      console.error(e);
    }
    setLoading(false);
  };

  const handleReset = () => {
    setResult(null);
    setYesterdayFile(null);
    setSevenDayFile(null);
    setError(null);
  };

  const buildTabs = (data) => {
    const allKeys = Object.keys(data);
    const priority = PRIORITY_TABS.filter(k => allKeys.includes(k));
    const rest = allKeys.filter(k => !PRIORITY_TABS.includes(k)).sort();
    return [...priority, ...rest];
  };

  const tabs = result ? buildTabs(result) : [];
  const tabData = result?.[activeTab];
  const anomalyCountForTab = tabData?.rows?.filter(r => r.isAnomaly).length ?? 0;
  const getTabLabel = (key) => MEDIA_DISPLAY[key] || key;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">📊</div>
          <div>
            <h1>AF 用户流失监控</h1>
            <p>对比昨日 vs 过去7天的事件转化率，自动识别异常</p>
          </div>
        </div>
        {result && (
          <button className="btn-reset" onClick={handleReset}>重新上传</button>
        )}
      </header>

      {!result ? (
        <div className="upload-section">
          <UploadBox
            yesterdayFile={yesterdayFile}
            sevenDayFile={sevenDayFile}
            onFilesChange={handleFilesChange}
          />

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn-analyze"
            disabled={!yesterdayFile || !sevenDayFile || loading}
            onClick={handleAnalyze}
          >
            {loading ? '分析中...' : '开始分析'}
          </button>

          <div className="upload-hint">
            <p>📌 使用说明</p>
            <ul>
              <li>从 AppsFlyer 事件面板分别导出「昨日」和「过去7日」的汇总绩效报告（CSV格式）</li>
              <li>同时选中这两个文件上传，<strong>第1个文件为昨日数据，第2个文件为7日数据</strong></li>
              <li>转化率 = 各事件独立用户数 ÷ vgsdk_af_app_active 独立用户数</li>
              <li>昨日转化率比7日转化率下降超过 <strong>3%</strong> 则标记为异常</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="result-section">
          <SummaryBar data={result} />

          <div className="tabs">
            {tabs.map(tab => {
              const count = result[tab]?.rows?.filter(r => r.isAnomaly).length ?? 0;
              const hasData = result[tab]?.rows?.length > 0;
              return (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'active' : ''} ${count > 0 ? 'has-anomaly' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {getTabLabel(tab)}
                  {hasData && count > 0 && (
                    <span className="tab-badge">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="tab-content">
            <div className="tab-header">
              <div className="tab-title">
                {getTabLabel(activeTab)}
                <span className="tab-active-info">
                  昨日 Active: <strong>{formatUsers(tabData?.yActive)}</strong>
                  &nbsp;｜ 7日 Active: <strong>{formatUsers(tabData?.sActive)}</strong>
                </span>
              </div>
              {anomalyCountForTab > 0 && (
                <div className="anomaly-summary">
                  ⚠ 发现 <strong>{anomalyCountForTab}</strong> 个异常事件（转化率下降 &gt;3%）
                </div>
              )}
            </div>
            <EventTable rows={tabData?.rows} />
          </div>
        </div>
      )}
    </div>
  );
}
