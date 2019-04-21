# bin2wav-cli
[![GitHub license](https://img.shields.io/github/license/kalininskiy/bin2wav.svg?style=plastic)](https://github.com/kalininskiy/bin2wav/blob/master/LICENSE)

CLI (утилита командной строки) версия онлайн-конвертера: http://thesands.ru/bk0010/wav-converter/.

Конвертер .bin-файлов БК в .wav-файлы для загрузки через магнитофонный вход.

(БК - Персональный компьютер Электроника БК-0010, БК-0010-01, БК-0011, БК-0011М).

This software is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY.

## Установка и использование

Для разработчиков:

	git clone https://github.com/kalininskiy/bin2wav.git

Установка для использования:

	sudo npm install -g bin2wav-cli

Использование:

```bash
bin2wav --input fileA.bin --output fileB.wav [--overwrite] [--model 11] [--speed] [--play]

    --input <ИмяФайла>: Имя/Путь входного бинарного файла для БК.
    --output <ИмяФайла>: Имя/Путь выходного WAV файла.
    --overwrite: Перезаписать существующий выходной WAV файл.
    --model 11: для чтения на БК-0011[М] (на 17% быстрее), несовместимо с БК-0010[-01].
    --speed: Дополнительное ускорение на 11%.
    --play: Начать проигрывание WAV файла сразу после конвертации (Mac/Linux/Windows).
```

## Лицензия

[MIT](https://github.com/kalininskiy/bin2wav/blob/master/LICENSE)
