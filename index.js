const AsyncStreamReader = require('node-async-stream-reader');
const { Readable } = require('stream');

/**
 * 一个wav文件（PCM格式）读取器，可以读取wav文件的头部信息，以及抽样读取wav的数据以供波形图使用。
 */
function WaveReader() {}

/**
 * 读取选项
 */
const DefaultOptions = {
    /**
     * 每个像素的样本数
     * @type {number}
     */
    samplePerPixel: 256,
    /**
     * 是否按照声道拆分数据，默认为 false。fasle表示采样时多个声道数据一起计算，结果的waveform的长度为1；true表示按照声道分开计算，分别存入waveform，数组长度取决于源的声道个数。
     */
    splitChannels: false,
    /**
     * 是否生成波形采样数据
     * @type {boolean}
     */
    generateWaveform: false,

}

/**
 * 从一个Readable流中获取wav信息
 * @param {Readable} stream wav流，可以是一个文件流，也可以是一个网络流
 * @param {DefaultOptions} options 读取选项
 */
WaveReader.load = async function(stream, options = DefaultOptions) {
    const reader = new AsyncStreamReader(stream);
    const chunkID = await reader.readString(4);
    if (chunkID !== 'RIFF') {
        throw new Error('Invalid RIFF chunk:', chunkID);
    }
    const chunkSize = await reader.readInt32LE();
    const format = await reader.readString(4);
    if (format !== 'WAVE') {
        throw new Error('Invalid WAVE format:', format);
    }
    const subChunk1ID = await reader.readString(4);
    if (subChunk1ID !== 'fmt ') {
        throw new Error('Invalid fmt chunk:', subChunk1ID);
    }
    const subChunk1Size = await reader.readInt32LE();
    const audioFormat = await reader.readInt16LE();
    const numChannels = await reader.readInt16LE();
    const sampleRate = await reader.readInt32LE();
    const byteRate = await reader.readInt32LE();
    const blockAlign = await reader.readInt16LE();
    const bitsPerSample = await reader.readInt16LE();
    //跳过subChunk2ID!=data的数据
    while (true) {
        const subChunk2ID = await reader.readString(4);
        if (subChunk2ID === 'data') {
            break;
        } else {
            //跳过该chunk的数据区
            await reader.read(await reader.readInt32LE());
        }
    }
    const dataChunkSize = await reader.readInt32LE();

    let wav = new WaveReader();
    wav = Object.assign(wav, { reader, chunkID, chunkSize, format, subChunk1ID, subChunk1Size, audioFormat, numChannels, sampleRate, byteRate, blockAlign, bitsPerSample, dataChunkSize });
    wav.len = wav.dataChunkSize / (wav.bitsPerSample / 8) / wav.numChannels;
    wav.duration = wav.dataChunkSize / wav.byteRate;
    wav.bitRate = wav.byteRate * 8;

    if (options.generateWaveform) {
        await wav.generateWaveform(options);
    }
    return wav;
}

WaveReader.prototype.toJSON = function() {
    //去掉reader属性
    const wav = Object.assign({}, this);
    delete wav.reader;
    return wav;
}

WaveReader.prototype.readSample = function() {
    return this.bitsPerSample === 8 ? this.reader.readInt8() : this.reader.readInt16LE();
}

/**
 * 生成波形数据并返回
 * @param {DefaultOptions} options 选项
 */
WaveReader.prototype.generateWaveform = async function(options = DefaultOptions) {
    options = Object.assign({}, DefaultOptions, options);
    if (options.outputChannels !== 1 && options.outputChannels !== 2) {
        throw new Error('outputChannels must be 1 or 2');
    }
    if (options.samplePerPixel < 2) {
        throw new Error('samplePerPixel must not less than 2');
    }
    let wav = this;
    if (wav.waveform != null) {
        return wav.waveform;
    }
    wav.samplePerPixel = options.samplePerPixel;
    wav.waveform = [];
    let max = [];
    let min = [];
    let outputChannels = options.splitChannels ? wav.numChannels : 1;
    for (let i = 0; i < outputChannels; i++) {
        wav.waveform.push([]);
        max.push(Number.MIN_SAFE_INTEGER);
        min.push(Number.MAX_SAFE_INTEGER);
    }
    let count = 0;
    for (let l = 0; l < wav.len; l++) {
        if (!options.splitChannels) {
            //如果输出结果合并为一个声道数据，则对所有声道数据的和取平均值
            let sampleNum = 0;
            for (let c = 0; c < wav.numChannels; c++) {
                let sampleNum_tmp = wav.readSample();
                if (sampleNum_tmp instanceof Promise) {
                    sampleNum_tmp = await sampleNum_tmp;
                }
                sampleNum += sampleNum_tmp;
            }
            sampleNum /= wav.numChannels;
            max[0] = Math.max(max[0], sampleNum);
            min[0] = Math.min(min[0], sampleNum);
            count++;
            //如果达到采样数或者数据结束了，则添加一个采样数据
            if (count === options.samplePerPixel || l === wav.len - 1) {
                wav.waveform[0].push(min[0]);
                wav.waveform[0].push(max[0]);
                max[0] = Number.MIN_SAFE_INTEGER;
                min[0] = Number.MAX_SAFE_INTEGER;
                count = 0;
            }
        } else {
            count++;
            let isSample = false;
            //如果按源文件声道数采样，则每个声道都要采样并单独计算和存储
            for (let c = 0; c < wav.numChannels; c++) {
                let sampleNum = wav.readSample();
                if (sampleNum instanceof Promise) {
                    sampleNum = await sampleNum;
                }
                max[c] = Math.max(max[c], sampleNum);
                min[c] = Math.min(min[c], sampleNum);
                //如果达到采样数或者数据结束了，则添加一个采样数据
                if (count === options.samplePerPixel || l >= wav.len - wav.numChannels) {
                    wav.waveform[c].push(min[c]);
                    wav.waveform[c].push(max[c]);
                    max[c] = Number.MIN_SAFE_INTEGER;
                    min[c] = Number.MAX_SAFE_INTEGER;
                    isSample = true;
                }
            }
            if (isSample) {
                count = 0;
            }
        }
    }
    return wav.waveform;
}

module.exports = WaveReader;