const WaveReader = require('../index.js');
const fs = require('fs');

async function test() {
    // let wav = await WaveReader.load(fs.createReadStream(__dirname + '/10s.wav'), { generateWaveform: true });
    // fs.writeFileSync(__dirname + '/10s.json', JSON.stringify(wav));
    console.time('readSample');
    let wav = await WaveReader.load(fs.createReadStream('D:/ffmpeg/fangmao_daxiang.2chanels.wav'), { generateWaveform: false, splitChannels: true });
    await wav.generateWaveform({});
    console.timeEnd('readSample');
    fs.writeFileSync('D:/ffmpeg/fangmao_daxiang.2chanels.wav.json', JSON.stringify(wav));
}

test();