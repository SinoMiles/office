import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let appGroup = "group.com.officegpt.officegptApp"
  private let pendingKey = "officegpt.pendingSharedFiles"

  private var started = false

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !started else { return }
    started = true
    let attachments = extensionContext?.inputItems.compactMap { ($0 as? NSExtensionItem)?.attachments }.flatMap { $0 } ?? []
    let providers = attachments.filter { provider in
      provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) ||
        provider.hasItemConformingToTypeIdentifier(UTType.image.identifier)
    }
    let group = DispatchGroup()
    var shared = [[String: Any]]()
    let lock = NSLock()

    for provider in providers.prefix(10) {
      group.enter()
      copy(provider: provider) { item in
        if let item {
          lock.lock()
          shared.append(item)
          lock.unlock()
        }
        group.leave()
      }
    }

    group.notify(queue: .main) { [weak self] in
      guard let self else { return }
      let defaults = UserDefaults(suiteName: self.appGroup)
      let existing = defaults?.array(forKey: self.pendingKey) as? [[String: Any]] ?? []
      defaults?.set(existing + shared, forKey: self.pendingKey)
      self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
  }

  private func copy(provider: NSItemProvider, completion: @escaping ([String: Any]?) -> Void) {
    let type = provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier)
      ? UTType.fileURL.identifier : UTType.image.identifier
    provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] item, _ in
      guard let self, let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: self.appGroup) else {
        completion(nil)
        return
      }
      let sourceURL: URL?
      if let url = item as? URL { sourceURL = url }
      else if let image = item as? UIImage {
        let url = container.appendingPathComponent("incoming-\(UUID().uuidString).jpg")
        try? image.jpegData(compressionQuality: 0.82)?.write(to: url)
        sourceURL = url
      } else { sourceURL = nil }
      guard let sourceURL else { completion(nil); return }
      let destination = container.appendingPathComponent("incoming-\(UUID().uuidString)-\(sourceURL.lastPathComponent)")
      do {
        if sourceURL != destination { try FileManager.default.copyItem(at: sourceURL, to: destination) }
        let size = (try? destination.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        completion(["name": destination.lastPathComponent, "path": destination.path, "size": size])
      } catch { completion(nil) }
    }
  }

}
