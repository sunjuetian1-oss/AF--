import Papa from 'papaparse';

// 媒体渠道映射（AF导出名 -> 显示名）
export const MEDIA_MAP = {
  'organic': 'Organic',
  'Facebook Ads': 'Facebook',
  'Apple Search Ads': 'ASA',
  'tiktokglobal_int': 'TikTok',
  'googleadwords_int': 'Google',
  'Google Ads': 'Google',
};

export const MEDIA_KEYS = ['overall', 'organic', 'Facebook Ads', 'Apple Search Ads', 'tiktokglobal_int', 'googleadwords_int'];
export const MEDIA_DISPLAY = {
  'overall': '整体',
  'organic': 'Organic',
  'Facebook Ads': 'Facebook',
  'Apple Search Ads': 'ASA',
  'tiktokglobal_int': 'TikTok',
  'googleadwords_int': 'Google',
  'Google Ads': 'Google',
};

export const ACTIVE_EVENT = 'vgsdk_af_app_active';
export const ANOMALY_THRESHOLD = 0.03; // 3%

// 漏斗事件顺序（按游戏进程排序）
export const FUNNEL_ORDER = [
  'vgsdk_af_app_active',
  'vgsdk_af_login_flow',
  'vgsdk_af_app_open',
  'vgsdk_af_initsdk',
  'vgsdk_af_sdk_init_success',
  'vgsdk_af_splash_screen_open',
  'vgsdk_af_get_configuration',
  'vgsdk_af_check_configuration_start',
  'vgsdk_af_check_configuration_finish',
  'vgsdk_af_detect_country',
  'vgsdk_af_bootstrap',
  'vgsdk_af_install',
  'vgsdk_af_registration',
  'vgsdk_af_openid_login',
  'vgsdk_af_show_login_form',
  'vgsdk_af_af_login',
  'vgsdk_af_enter_game',
  'vgsdk_af_first_time_login',
  'vgsdk_af_cdn_download_start',
  'vgsdk_af_cdn_download_25',
  'vgsdk_af_cdn_download_50',
  'vgsdk_af_cdn_download_75',
  'vgsdk_af_cdn_download_finish',
  'vgsdk_af_extract_resource_start',
  'vgsdk_af_extract_resource_end',
  'vgsdk_af_loading_start',
  'vgsdk_af_loading_complete',
  'vgsdk_af_tutorial_start',
  'vgsdk_af_level_1',
  'vgsdk_af_create_role_success',
  'vgsdk_af_tutorial_complete',
  'vgsdk_af_main_task_120005',
  'vgsdk_af_main_task_120010',
  'vgsdk_af_main_task_120011',
  'vgsdk_af_main_task_61001',
  'vgsdk_af_main_task_61002',
  'vgsdk_af_main_task_61003',
  'vgsdk_af_main_task_61004',
  'vgsdk_af_main_task_61005',
  'vgsdk_af_main_task_61006',
  'vgsdk_af_main_task_61007',
  'vgsdk_af_main_task_64001',
  'vgsdk_af_main_task_64002',
  'vgsdk_af_main_task_64003',
  'vgsdk_af_main_task_64008',
  'vgsdk_af_level_10',
  'vgsdk_af_level_20',
  'vgsdk_af_level_30',
  'vgsdk_af_plaza_enter',
  'vgsdk_af_plaza_sparkle',
  'vgsdk_af_plaza_treasure1',
  'vgsdk_af_plaza_finishtask',
  'vgsdk_af_rr1',
  'vgsdk_af_rr2',
  'vgsdk_af_chat_behavior',
  'vgsdk_af_friend_send',
  'vgsdk_af_request_info',
  'vgsdk_af_iap_status',
  'af_purchase',
  'vgsdk_af_app_inactive',
  'vgsdk_af_openid_logout',
];

// 解析数字（处理逗号、$符号、N/A）
function parseNumber(val) {
  if (!val || val === 'N/A') return null;
  return parseFloat(val.replace(/[$,]/g, '')) || 0;
}

// 解析CSV，返回按媒体分组的事件数据
// 结构：{ [mediaChannel]: { [eventName]: uniqueUsers } }
export function parseCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().replace(/^\uFEFF/, ''),
  });

  const data = {}; // { media: { event: users } }
  let currentMedia = null;

  result.data.forEach(row => {
    const media = row['媒体渠道']?.trim();
    const event = row['应用内事件']?.trim();
    const usersRaw = row['独立用户数']?.trim();

    if (media) {
      currentMedia = media;
      if (!data[currentMedia]) data[currentMedia] = {};
    }

    if (currentMedia && event) {
      const users = parseNumber(usersRaw);
      if (users !== null) {
        data[currentMedia][event] = users;
      }
    }
  });

  return data;
}

// 计算所有媒体合并后的整体数据
function calcOverall(data) {
  const overall = {};
  const targetMedias = Object.keys(MEDIA_DISPLAY).filter(k => k !== 'overall');

  targetMedias.forEach(media => {
    if (!data[media]) return;
    Object.entries(data[media]).forEach(([event, users]) => {
      overall[event] = (overall[event] || 0) + users;
    });
  });

  return overall;
}

// 计算比值：每个事件 / active
function calcRatios(eventData) {
  const active = eventData[ACTIVE_EVENT];
  if (!active || active === 0) return {};

  const ratios = {};
  Object.entries(eventData).forEach(([event, users]) => {
    ratios[event] = users / active;
  });
  return ratios;
}

// 对事件按漏斗顺序排序，未知事件放最后
function sortByFunnel(events) {
  return [...events].sort((a, b) => {
    const ia = FUNNEL_ORDER.indexOf(a);
    const ib = FUNNEL_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// 主分析函数：对比昨天 vs 7天
export function analyzeData(yesterdayCSV, sevenDayCSV) {
  const yesterday = parseCSV(yesterdayCSV);
  const sevenDay = parseCSV(sevenDayCSV);

  // 加入整体数据
  yesterday['overall'] = calcOverall(yesterday);
  sevenDay['overall'] = calcOverall(sevenDay);

  const result = {};

  const allMedias = ['overall', ...Object.keys(MEDIA_DISPLAY).filter(k => k !== 'overall')];

  allMedias.forEach(media => {
    const yData = yesterday[media] || {};
    const sData = sevenDay[media] || {};

    const yRatios = calcRatios(yData);
    const sRatios = calcRatios(sData);

    // 收集所有事件
    const allEvents = new Set([
      ...Object.keys(yRatios),
      ...Object.keys(sRatios),
    ]);
    allEvents.delete(ACTIVE_EVENT);

    const events = sortByFunnel([...allEvents]);

    const rows = events.map(event => {
      const yRatio = yRatios[event] ?? null;
      const sRatio = sRatios[event] ?? null;
      const yUsers = yData[event] ?? null;
      const sUsers = sData[event] ?? null;
      const yActive = yData[ACTIVE_EVENT] ?? null;
      const sActive = sData[ACTIVE_EVENT] ?? null;

      let diff = null;
      let isAnomaly = false;

      if (yRatio !== null && sRatio !== null && sRatio > 0) {
        diff = yRatio - sRatio; // 正数=上升，负数=下降
        isAnomaly = diff < -ANOMALY_THRESHOLD;
      }

      return {
        event,
        yUsers,
        yActive,
        yRatio,
        sUsers,
        sActive,
        sRatio,
        diff,
        isAnomaly,
      };
    });

    result[media] = {
      rows,
      yActive: yData[ACTIVE_EVENT] ?? null,
      sActive: sData[ACTIVE_EVENT] ?? null,
    };
  });

  return result;
}
