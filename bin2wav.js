/**
 * CLI версия онлайн-конвертера: http://thesands.ru/bk0010/wav-converter/
 *
 * Конвертер .bin-файлов БК в .wav-файлы для загрузки через магнитофонный вход
 *
 */

const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const exec = require('child_process').exec;

const LEVEL_1 = 255;
const LEVEL_1_TUNE = 248;
const LEVEL_0 = 128;
const BIT_0 = [
    LEVEL_1, LEVEL_1,
    LEVEL_0, LEVEL_0
];
const BIT_1 = [
    LEVEL_1, LEVEL_1, LEVEL_1, LEVEL_1,
    LEVEL_0, LEVEL_0, LEVEL_0, LEVEL_0
];
const TUNE = [
    LEVEL_1_TUNE, LEVEL_1_TUNE,
    LEVEL_0, LEVEL_0
];
const AFTER_TUNE = [
    LEVEL_1, LEVEL_1, LEVEL_1, LEVEL_1, LEVEL_1, LEVEL_1, LEVEL_1, LEVEL_1,
    LEVEL_0, LEVEL_0, LEVEL_0, LEVEL_0, LEVEL_0, LEVEL_0, LEVEL_0, LEVEL_0
];
const SYNCHRO_SHORT = [
    LEVEL_1_TUNE, LEVEL_1_TUNE,
    LEVEL_0
];
const SYNCHRO_LONG = [
    LEVEL_1_TUNE, LEVEL_1_TUNE,
    LEVEL_0, LEVEL_0
];

const SAMPLE_RATE_10 = 21428;
const SAMPLE_RATE_11 = 25000;

const TUNE_COUNT = 4096;
const TUNE_COUNT_SECOND = 10;
const TUNE_COUNT_END = 200;

const ADDRESS_MIN = '320';
const ADDRESS_MAX = '177600';

/**
 * Функция преобразования бинарных данных в тело wav-файла
 *
 * @param binary
 * @param speedBoost - true || false
 * @returns {Array}
 */
const binaryToSoundBytes = (binary, speedBoost) => {
    const soundBytes = [];
    const push = getPushFunction(soundBytes);
    for (let i = 0; i < TUNE_COUNT; i++) {
        push(TUNE);
    }
    push(AFTER_TUNE);
    push(BIT_1);
    for (let i = 0; i < TUNE_COUNT_SECOND; i++) {
        push(TUNE);
    }
    push(AFTER_TUNE);
    push(BIT_1);
    let synchro = speedBoost ? SYNCHRO_SHORT : SYNCHRO_LONG;
    for (let i = 0; i < binary.length; i++) {
        if (i === 20) {
            // после заголовков
            for (let j = 0; j < TUNE_COUNT_SECOND; j++) {
                push(TUNE);
            }
            push(AFTER_TUNE);
            push(BIT_1);
        } else if (i === binary.length - 2) {
            // для контрольной суммы - длинный синхроимпульс
            synchro = SYNCHRO_LONG;
        }
        const byte = binary[i];
        for (let bit = 1; bit < 255; bit <<= 1) {
            push(synchro);
            push(byte & bit ? BIT_1 : BIT_0);
        }
    }
    for (let i = 0; i < TUNE_COUNT_END; i++) {
        push(TUNE);
    }
    return soundBytes;
};

/**
 * Упрощения кода вставки
 *
 * @param arr
 * @returns {Function}
 */
const getPushFunction = (arr) => {
    const push = Array.prototype.push;
    return function (bytes) {
        push.apply(arr, bytes);
    }
};

/**
 * Проверка валидности бинарного файла
 *
 * @param binary
 * @returns {boolean}
 */
const checkFile = (binary) => {
    let error = '';
    if (binary.length < 6) {
        error = 'Слишком короткий bin-файл';
    } else {
        const address = binary[0] + (binary[1] << 8);
        const size = binary[2] + (binary[3] << 8);
        if (size !== binary.length - 4) {
            error = 'Некорректный размер';
        } else if (address < parseInt(ADDRESS_MIN, 8)) {
            error = 'Адрес загрузки меньше ' + ADDRESS_MIN;
        } else if (address >= parseInt(ADDRESS_MAX, 8)) {
            error = 'Адрес загрузки больше ' + ADDRESS_MAX;
        } else if (address + size > parseInt(ADDRESS_MAX, 8)) {
            error = 'Адрес + размер больше ' + ADDRESS_MAX;
        }
        if (error) {
            error = 'Ошибка в bin-файле: ' + error;
        }
    }
    if (error !== '') {
        console.error(`${error}`);
    }
    return !error;
};

/**
 * Внедрение имени файла и контрольной суммы в бинарные данные
 *
 * @param binary
 * @param fileName
 * @returns {Uint8Array}
 */
let insertFileNameAndChekSum = (binary, fileName) => {
    const newBinary = new Uint8Array(binary.length + 16 + 2);
    newBinary.set(binary.subarray(0, 4));
    newBinary.set(convertFileNameToBytes(fileName), 4);
    const body = binary.subarray(4);
    newBinary.set(body, 20);
    let checkSum = 0;
    for (let i = 0; i < body.length; i++) {
        checkSum += body[i];
        if (checkSum > 65535) { // переполнение
            checkSum -= 65536;
            checkSum++;
        }
    }
    newBinary.set(
        new Uint8Array([
            checkSum & 0xff,
            (checkSum >> 8) & 0xff
        ]),
        20 + body.length
    );
    return newBinary;
};

/**
 * Добавление заголовков wav-файла к телу
 *
 * @param soundBytes
 * @param sampleRate
 * @returns {*[]}
 */
const toWavFile = (soundBytes, sampleRate) => {
    const channelCount = 1;
    const bitsPerSample = 8;
    const subChunk1Size = 16;
    const subChunk2Size = soundBytes.length;
    const chunkSize = 4 + (8 + subChunk1Size) + (8 + subChunk2Size);
    const blockAlign = channelCount * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    return [
        82, 73, 70, 70,               // "RIFF" in ASCII
        chunkSize & 0xff,             // Chunk Size
        (chunkSize >> 8) & 0xff,
        (chunkSize >> 16) & 0xff,
        (chunkSize >> 24) & 0xff,
        87, 65, 86, 69,               // "WAVE" in ASCII
        102, 109, 116, 32,            // "fmt " in ASCII
        subChunk1Size, 0, 0, 0,       // Sub chunk 1 size (always 16)
        1, 0,                         // Audio format (1 == PCM)
        channelCount & 0xff,          // Number Channels
        (channelCount >> 8) & 0xff,
        sampleRate & 0xff,            // Sample Rate
        (sampleRate >> 8) & 0xff,
        (sampleRate >> 16) & 0xff,
        (sampleRate >> 24) & 0xff,
        byteRate & 0xff,              // Byte Rate
        (byteRate >> 8) & 0xff,
        (byteRate >> 16) & 0xff,
        (byteRate >> 24) & 0xff,
        blockAlign & 0xff,            // Block Align
        (blockAlign >> 8) & 0xff,
        bitsPerSample & 0xff,         // Bits per sample
        (bitsPerSample >> 8) & 0xff,
        100, 97, 116, 97,             // "data" in ASCII
        subChunk2Size & 0xff,         // Sub chunk 1 size
        (subChunk2Size >> 8) & 0xff,
        (subChunk2Size >> 16) & 0xff,
        (subChunk2Size >> 24) & 0xff
    ].concat(soundBytes);
};

const convertFileNameToBytes = (name) => {
    // Побеждаем глюк файловой системы macos с буквами Й и Ё
    name = name
        .replace(/И\u0306/g, 'Й')
        .replace(/и\u0306/g, 'й')
        .replace(/Е\u0308/g, 'Ё')
        .replace(/е\u0308/g, 'ё');
    name = name.substr(0, 16);
    if (name.length < 16) {
        for (let i = name.length; i < 16; i++) {
            name += ' ';
        }
    }
    return new Uint8Array(getKOI8Bytes(name));
};

const getKOI8Bytes = (text) => {
    const charsList = 'юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ';
    const bytes = [];
    let code, char, index;
    for (let i = 0; i < text.length; i++) {
        code = text.charCodeAt(i);
        if (code < 32) {
            code = 32;
        } else if (code > 127) {
            char = text[i];
            index = charsList.indexOf(char);
            if (index > -1) {
                code = 192 + index;
            } else if (char === 'Ё') {
                code = 229; // Е
            } else if (char === 'ё') {
                code = 197; // е
            } else {
                code = 32;
            }
        }
        bytes.push(code);
    }
    return bytes;
};

/**
 * Проверка на обязательные параметры
 *
 * @param argv
 * @returns {boolean}
 */
const validateArgs = (argv) => {
    const parametersArray = ['input', 'output', ];
    let result = true;
    let parameters = [];

    for (let parameter of parametersArray) {
        if (!argv[parameter]) {
            parameters.push(parameter);
            result = false;
        }
    }
    if (!result) {
        console.log(`Error: missing required parameters: ${parameters}\n`);
    }
    return result;
};

/**
 * Точка входа
 *
 * @returns {Promise<boolean>}
 */
module.exports = async () => {
    console.log('\nCLI версия онлайн-конвертера: http://thesands.ru/bk0010/wav-converter/');
    console.log('Конвертер .bin-файлов БК в .wav-файлы для загрузки через магнитофонный вход\n');

    console.log('Usage: \n bin2wav --input fileA.bin --output fileB.wav [--overwrite] [--model 11] [--speed] [--playMac] [--playLinux] [--playWin]\n');

    // Проверяем обязательные параметры
    if (!validateArgs(argv)) {
        return false;
    }

    const inputFilePath = argv['input'];
    const outputFilePath = argv['output'];
    const overwrite = !!(argv['overwrite']);

    // Проверяем отсутствие выходного файла
    if (!overwrite) {
        if (fs.existsSync(outputFilePath)) {
            console.log(`Error! File '${outputFilePath}' already exists. Cancel...\n`);
            return false;
        }
    }

    let binaryFile;

    // Считываем бинарник
    if (fs.existsSync(inputFilePath)) {
        console.log(`File '${inputFilePath}' exists. Reading now ...\n`);
        binaryFile = fs.readFileSync(inputFilePath);
    } else {
        console.log(`Error: file '${inputFilePath}' NOT exists...\n`);
        return false;
    }

    let binary = new Uint8Array(binaryFile);

    const model = (argv['model']) ? argv['model'] : '10';
    const speedBoost = !!(argv['speed']);
    const toPlay = !!(argv['playMac']) || !!(argv['playLinux']) || !!(argv['playWin']);

    // Проверяем считанный бинарный файл
    if (checkFile(binary)) {
        const baseName = inputFilePath.replace(/\..*?$/, '');
        binary = insertFileNameAndChekSum(binary, baseName);

        console.log(`Start convert file: '${inputFilePath}' to '${outputFilePath}'\n`);

        const soundBytes = binaryToSoundBytes(binary, speedBoost);
        const sampleRate = (model === '11') ? SAMPLE_RATE_11 : SAMPLE_RATE_10;
        const wavFile = toWavFile(soundBytes, sampleRate);

        const buffer = new Buffer.from(wavFile);
        fs.writeFileSync(outputFilePath, buffer);

        console.log(`File: '${inputFilePath}' to '${outputFilePath}' converted successfully...\n`);

        // Play WAV immediately
        if (toPlay) {
            console.log(`Playing WAV: ${outputFilePath}\n`);
            let playPath = '';

            if (!!(argv['playMac'])) {
                playPath = `afplay ${outputFilePath}`;
            }
            if (!!(argv['playLinux'])) {
                playPath = `aplay ${outputFilePath}`;
            }
            if (!!(argv['playWin'])) {
                playPath = `start "${outputFilePath}"`;
            }
            const puts = (error, stdout, stderr) => {
                console.log(stdout);
                if (error !== null) {
                    console.log('exec error: ' + error);
                }
            };
            exec(playPath, puts);
        }
    } else {
        console.log('Failed with error in binary file...\n');
        return false;
    }

    return true;
};
