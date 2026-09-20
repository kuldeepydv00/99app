import AppKit

let srcPath = "/Users/kuldeep/.gemini/antigravity/brain/35f71355-3bc0-4eab-ab23-0d8152e55a81/.user_uploaded/media_1787160615083.png"
let outPath = "/Users/kuldeep/app 2/website/public/app_logo.png"

guard let image = NSImage(contentsOfFile: srcPath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("Failed to load source image")
    exit(1)
}

let cropRect = CGRect(x: 0, y: 0, width: 76, height: 76)
guard let croppedCg = cgImage.cropping(to: cropRect) else {
    print("Failed to crop CGImage")
    exit(1)
}

let newRep = NSBitmapImageRep(cgImage: croppedCg)
guard let pngData = newRep.representation(using: .png, properties: [:]) else {
    print("Failed PNG representation")
    exit(1)
}

do {
    try pngData.write(to: URL(fileURLWithPath: outPath))
    print("CROP SUCCESSFUL")
} catch {
    print("Write failed: \(error)")
}
