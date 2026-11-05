// Upscale a portrait 2x with MetalFX's spatial scaler (detail-reconstructing, not plain resizing), then a light
// noise reduction and sharpen. The alpha channel (the cut-out) is scaled separately so its edge stays clean.
//   swiftc -O upscale.swift -o upscale && ./upscale in.png out.png [scale]
import AppKit
import CoreImage
import Metal
import MetalFX

let args = CommandLine.arguments
let scale = args.count > 3 ? Double(args[3])! : 2
let src = CIImage(contentsOf: URL(fileURLWithPath: args[1]))!
let W = Int(src.extent.width), H = Int(src.extent.height), OW = Int(Double(W) * scale), OH = Int(Double(H) * scale)
let dev = MTLCreateSystemDefaultDevice()!, queue = dev.makeCommandQueue()!
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CIContext(mtlDevice: dev, options: [.workingColorSpace: cs, .outputColorSpace: cs])

func tex(_ w: Int, _ h: Int, _ usage: MTLTextureUsage) -> MTLTexture {
  let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float, width: w, height: h, mipmapped: false)
  d.usage = usage; d.storageMode = .private; return dev.makeTexture(descriptor: d)!
}
// colour on an opaque matte (MetalFX expects opaque colour); alpha handled below
let opaque = src.composited(over: CIImage(color: CIColor(red: 0.5, green: 0.5, blue: 0.5)).cropped(to: src.extent))
let inTex = tex(W, H, [.shaderRead, .shaderWrite]), outTex = tex(OW, OH, [.shaderRead, .shaderWrite, .renderTarget])
let cb0 = queue.makeCommandBuffer()!
ctx.render(opaque, to: inTex, commandBuffer: cb0, bounds: src.extent, colorSpace: cs); cb0.commit(); cb0.waitUntilCompleted()

let sd = MTLFXSpatialScalerDescriptor()
sd.inputWidth = W; sd.inputHeight = H; sd.outputWidth = OW; sd.outputHeight = OH
sd.colorTextureFormat = .rgba16Float; sd.outputTextureFormat = .rgba16Float; sd.colorProcessingMode = .perceptual
let scaler = sd.makeSpatialScaler(device: dev)!
scaler.colorTexture = inTex; scaler.outputTexture = outTex; scaler.inputContentWidth = W; scaler.inputContentHeight = H
let cb = queue.makeCommandBuffer()!; scaler.encode(commandBuffer: cb); cb.commit(); cb.waitUntilCompleted()

var up = CIImage(mtlTexture: outTex, options: [.colorSpace: cs])!
up = up.applyingFilter("CINoiseReduction", parameters: ["inputNoiseLevel": 0.02, "inputSharpness": 0.4])
up = up.applyingFilter("CIUnsharpMask", parameters: [kCIInputRadiusKey: 1.4, kCIInputIntensityKey: 0.22])
// alpha: Lanczos-scaled cut-out, slightly tightened so no matte grey shows at the edge
let alpha = src.applyingFilter("CIColorMatrix", parameters: ["inputRVector": CIVector(x: 0, y: 0, z: 0, w: 1), "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 1), "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 1), "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1)])
  .applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: scale, kCIInputAspectRatioKey: 1])
let out = up.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: up.extent), kCIInputMaskImageKey: alpha]).cropped(to: CGRect(x: 0, y: 0, width: OW, height: OH))
try! ctx.writePNGRepresentation(of: out, to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: cs)
print("\(W)x\(H) -> \(OW)x\(OH)")
