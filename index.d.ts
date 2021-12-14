import { Readable } from 'stream';

interface Options {
    /**
     * 每个像素的样本数
     */
    samplePerPixel: number,
    /**
     * 是否按照声道拆分数据，默认为 false。fasle表示采样时多个声道数据一起计算，结果的waveform的长度为1；true表示按照声道分开计算，分别存入waveform，数组长度取决于源的声道个数。
     */
    splitChannels: boolean,
    /**
     * 是否生成波形采样数据
     */
    generateWaveform: boolean,
}

/**
 * 一个wav文件（PCM格式）读取器，可以读取wav文件的头部信息，以及抽样读取wav的数据以供波形图使用。
 */
class WaveReader {
    /**
     * 从一个Readable流中获取wav信息
     * @param stream wav流，可以是一个文件流，也可以是一个网络流
     * @param options 选项
     */
    static load(stream: Readable, options: Options): WaveReader;
    /**
     * 生成波形数据并返回
     * @param options 选项
     */
    generateWaveform(options: Options): WaveForm;

    samplePerPixel: number;

    chunkID: string;
    chunkSize: number;
    format: string;
    subchunk1ID: string;
    subChunk1Size: number;
    audioFormat: number;
    numChannels: number;
    sampleRate: number;
    byteRate: number;
    blockAlign: number;
    bitsPerSample: number;
    dataChunkSize: number;
    len: number;
    duration: number;
    bitRate: number;

    waveform: WaveForm;
}

declare type WaveForm = [[number]];

export = WaveReader;