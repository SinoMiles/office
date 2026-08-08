import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let incomingChannelName = "officegpt/incoming_files"
  private var incomingChannel: FlutterMethodChannel?
  private var pendingFiles: [[String: Any]] = []

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    if let controller = window?.rootViewController as? FlutterViewController {
      incomingChannel = FlutterMethodChannel(
        name: incomingChannelName,
        binaryMessenger: controller.binaryMessenger
      )
      incomingChannel?.setMethodCallHandler { [weak self] call, result in
        guard call.method == "getInitialFiles" else {
          result(FlutterMethodNotImplemented)
          return
        }
        result(self?.drainPending() ?? [])
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if let file = copyIncoming(url) {
      pendingFiles.append(file)
      incomingChannel?.invokeMethod("incomingFiles", arguments: drainPending())
      return true
    }
    return super.application(app, open: url, options: options)
  }

  private func copyIncoming(_ url: URL) -> [String: Any]? {
    let access = url.startAccessingSecurityScopedResource()
    defer { if access { url.stopAccessingSecurityScopedResource() } }
    do {
      let manager = FileManager.default
      let directory = manager.temporaryDirectory.appendingPathComponent("incoming", isDirectory: true)
      try manager.createDirectory(at: directory, withIntermediateDirectories: true)
      let name = url.lastPathComponent.isEmpty ? "共享文件" : url.lastPathComponent
      let target = directory.appendingPathComponent("\(Int(Date().timeIntervalSince1970 * 1000))-\(name)")
      if manager.fileExists(atPath: target.path) { try manager.removeItem(at: target) }
      try manager.copyItem(at: url, to: target)
      let values = try target.resourceValues(forKeys: [.fileSizeKey])
      return ["name": name, "path": target.path, "size": values.fileSize ?? 0]
    } catch {
      return nil
    }
  }

  private func drainPending() -> [[String: Any]] {
    let files = pendingFiles
    pendingFiles.removeAll()
    return files
  }
}
