// --- CONFIGURATION ---
// IMPORTANT: Replace this with the ID of your Google Sheet.
const SHEET_ID = 'SHEET_ID'; 
const SHEET_NAME = 'Tasks'; // The name of the tab/sheet where tasks are stored.

/**
 * @description Serves the HTML file as the web app's user interface.
 * @returns {HtmlOutput} The HTML page to be displayed.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Executive Task Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * @description Includes other HTML files into the main template (for modularity).
 * @param {string} filename The name of the HTML file to include.
 * @returns {string} The raw content of the HTML file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// --- DATA FUNCTIONS (Callable from Frontend) ---

/**
 * @description Gets all tasks from the Google Sheet.
 * @returns {Object[]} An array of task objects.
 */
function getTasks() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    // Get all data, assuming row 1 is headers. Read 7 columns now.
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    
    if (!data || data.length === 0) return [];
    
    const tasks = data.map(row => ({
      id: row[0],
      name: row[1],
      assignee: row[2],
      dueDate: row[3] ? new Date(row[3]).toLocaleDateString() : '',
      priority: row[4],
      status: row[5],
      completedDate: row[6] ? new Date(row[6]) : null
    }));
    return tasks;
  } catch(e) {
    console.error("Error in getTasks: " + e.toString());
    return [];
  }
}

/**
 * @description Adds a new task to the Google Sheet.
 * @param {Object} taskData - The data for the new task.
 * @returns {Object} A success or error message.
 */
function addTask(taskData) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const newId = 'TASK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const dueDate = new Date(taskData.dueDate);
    
    // Append a blank for the completedDate column
    sheet.appendRow([
      newId,
      taskData.name,
      taskData.assignee,
      dueDate,
      taskData.priority,
      taskData.status,
      '' 
    ]);
    
    return { success: true, message: 'Task added successfully.' };
  } catch(e) {
    console.error("Error in addTask: " + e.toString());
    return { success: false, message: 'Failed to add task.' };
  }
}

/**
 * @description Updates the status of an existing task and logs completion date.
 * @param {string} taskId - The ID of the task to update.
 * @param {string} newStatus - The new status value.
 * @returns {Object} A success or error message.
 */
function updateTaskStatus(taskId, newStatus) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    
    let rowToUpdate = -1;
    for(let i = 0; i < data.length; i++) {
      if(data[i][0] == taskId) {
        rowToUpdate = i + 2; 
        break;
      }
    }
    
    if (rowToUpdate !== -1) {
      sheet.getRange(rowToUpdate, 6).setValue(newStatus); // Column F is 'status'
      // If task is completed, set completion date. Otherwise, clear it.
      const completionDate = (newStatus === 'Completed') ? new Date() : '';
      sheet.getRange(rowToUpdate, 7).setValue(completionDate); // Column G is 'completedDate'

      return { success: true, message: 'Status updated.' };
    } else {
      return { success: false, message: 'Task ID not found.' };
    }
  } catch (e) {
    console.error("Error in updateTaskStatus: " + e.toString());
    return { success: false, message: 'Failed to update status.' };
  }
}

/**
 * @description Calculates and returns key metrics for the dashboard.
 * @returns {Object} An object containing dashboard metrics.
 */
function getDashboardMetrics() {
    const tasks = getTasks();
    if (!tasks || tasks.length === 0) {
        return {
            totalTasks: 0, completed: 0, inProgress: 0, overdue: 0,
            statusBreakdown: [], priorityBreakdown: [], completionTrend: []
        };
    }

    // --- Basic Metrics ---
    const metrics = {
        totalTasks: tasks.length,
        completed: tasks.filter(t => t.status === 'Completed').length,
        inProgress: tasks.filter(t => t.status === 'In Progress').length,
        overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length,
    };
    
    // --- Chart Data ---
    const statusCounts = tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
    }, {});
    metrics.statusBreakdown = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));

    const priorityCounts = tasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
    }, {});
    metrics.priorityBreakdown = Object.keys(priorityCounts).map(key => ({ name: key, value: priorityCounts[key] }));

    // --- Completion Trend Data (Last 7 Days) ---
    const trendData = {};
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const a = d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
        labels.push(a);
        trendData[a] = 0;
    }

    tasks.forEach(task => {
        if (task.status === 'Completed' && task.completedDate) {
            const completedDate = new Date(task.completedDate);
            const key = completedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
            if (key in trendData) {
                trendData[key]++;
            }
        }
    });

    metrics.completionTrend = labels.map(label => ({ date: label, count: trendData[label] }));
    
    return metrics;
}
