const runtimes = global.officeWebTaskRuntimes || new Map();
global.officeWebTaskRuntimes = runtimes;

export function startTaskRuntime(taskId) {
  const controller = new AbortController();
  runtimes.set(String(taskId), controller);
  return controller;
}

export function cancelTaskRuntime(taskId) {
  const controller = runtimes.get(String(taskId));
  if (!controller) return false;
  controller.abort();
  return true;
}

export function finishTaskRuntime(taskId) {
  runtimes.delete(String(taskId));
}
