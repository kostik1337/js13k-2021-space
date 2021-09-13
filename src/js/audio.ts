import { Freeverb } from "./freeverb";
import { sstep } from "./math";

export type AudioProc = {
    noise: (gain: number) => void
}

export function setupAudioProcessor(): AudioProc {
    let context = new AudioContext();

    const sequencer = (bpm: number): AudioNode => {
        const samplesPerBeat = context.sampleRate * 60 / (bpm * 4)
        const chordProgression = [
            [0, 3, 7, 10, 7, 15, 12],
            [0, 3, 7, 12, 3, 15, 10],
            [3, 12, 10, 7, 3, 12, 17],
            [7, 9, 10, 12, 7, 12, 19],
            [0, 3, 7, 10, 7, 15, 12],
            [0, 3, 7, 12, 3, 15, 10],
            [3, 5, 12, 15, 3, 17, 15],
            [7, 10, 15, 17, 10, 15, 19],
        ]
        let currentSample = 0
        let currentChord = 0
        let timeUntilNoteUp = 0
        let iUp = -1
        const noteToFreq = (note: number) => 220 * Math.pow(2, note / 12)
        const seq = context.createScriptProcessor(null, 0, 6);
        seq.onaudioprocess = (event) => {
            let outputBuffer = event.outputBuffer;
            let outputDataGain = outputBuffer.getChannelData(0);
            let outputDataFreq = outputBuffer.getChannelData(1);

            let outputDataChord = [2, 3, 4, 5].map(x => outputBuffer.getChannelData(x));
            for (let sample = 0; sample < outputBuffer.length; sample++) {
                currentSample++
                if (currentSample >= samplesPerBeat * chordProgression[currentChord].length * 4) {
                    currentSample = 0
                    currentChord = (currentChord + 1) % chordProgression.length
                }
                let factor = (currentSample % samplesPerBeat) / samplesPerBeat
                let envParams = [0.1, 0.9]
                let envelope = sstep(0, envParams[0], factor) * (1 - sstep(envParams[0], envParams[1], factor))
                outputDataGain[sample] = envelope;
                const beatId = Math.floor(currentSample / samplesPerBeat) % chordProgression[currentChord].length
                outputDataFreq[sample] = noteToFreq(chordProgression[currentChord][beatId]);

                timeUntilNoteUp -= 1
                if (timeUntilNoteUp < 0.) {
                    if (iUp == -1) iUp = Math.floor(Math.random() * 3)
                    if (timeUntilNoteUp < -0.3 * context.sampleRate) {
                        iUp = -1
                        timeUntilNoteUp = (1. + 3 * Math.random()) * context.sampleRate
                    }
                }
                outputDataChord.forEach((proc, i) => {
                    proc[sample] = noteToFreq(chordProgression[currentChord][i + 1] - 12 + (iUp == i ? 24 : 0));
                })
            }
        }
        const splitter = context.createChannelSplitter(6)
        seq.connect(splitter)
        return splitter
    }

    const bpm = 90

    const audioPostproc = (): GainNode => {
        let reverb = Freeverb(context, .7, .4, .8, 6000)
        reverb.connect(context.destination);

        let delay = context.createDelay(1.0);
        delay.delayTime.value = 60 / bpm / 1.5;
        let delayGain = context.createGain();
        delayGain.gain.value = .3;

        let gain = context.createGain();
        gain.gain.value = 0;

        gain.connect(delay)
        delay.connect(delayGain)
        delayGain.connect(delay)
        delay.connect(reverb)
        return gain
    }

    const postproc = audioPostproc()

    let arpegOsc = context.createOscillator();
    arpegOsc.frequency.value = 0
    arpegOsc.type = 'triangle';
    arpegOsc.start();

    let oscGain = context.createGain()
    arpegOsc.connect(oscGain)
    oscGain.connect(postproc)

    const padOscs = [0, 0, 0, 0].map(x => {
        let lfo = context.createOscillator()
        lfo.frequency.value = 0.3 + 0.3 * Math.random()
        lfo.type = 'sine';
        lfo.start();

        let lfoGain = context.createGain()
        lfoGain.gain.value = 10
        lfo.connect(lfoGain)

        let osc = context.createOscillator();
        osc.frequency.value = 0
        osc.type = 'sine';
        osc.start();

        lfoGain.connect(osc.detune)
        let oscGain = context.createGain()
        osc.connect(oscGain)
        oscGain.connect(postproc)
        return osc
    })

    let noise = context.createScriptProcessor(null, 0, 1)
    noise.onaudioprocess = (event) => {
        let outputBuffer = event.outputBuffer;
        let outputData = outputBuffer.getChannelData(0);
        for (let sample = 0; sample < outputBuffer.length; sample++) {
            outputData[sample] = 2 * Math.random() - 1
        }
    }
    let noiseFilter = context.createBiquadFilter()
    noiseFilter.type = "bandpass"
    noiseFilter.frequency.value = 2000
    noiseFilter.Q.value = 14
    let noiseFiltLfo = context.createOscillator()
    noiseFiltLfo.frequency.value = 0.4
    noiseFiltLfo.type = 'sine'
    noiseFiltLfo.start()
    let noiseFiltLfoGain = context.createGain()
    noiseFiltLfoGain.gain.value = 200
    let noiseGain = context.createGain()

    noiseFiltLfo.connect(noiseFiltLfoGain)
    noiseFiltLfoGain.connect(noiseFilter.detune)
    noiseFilter.frequency
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(postproc)

    const seq = sequencer(bpm)
    seq.connect(oscGain.gain, 0)
    seq.connect(arpegOsc.frequency, 1)
    seq.connect(padOscs[0].frequency, 2)
    seq.connect(padOscs[1].frequency, 3)
    seq.connect(padOscs[2].frequency, 4)
    seq.connect(padOscs[3].frequency, 5)

    postproc.gain.linearRampToValueAtTime(0.05, context.currentTime + 3);

    return {
        noise: (g) => {
            // noiseFilter.frequency.value = 2000 + 400 * g
            noiseGain.gain.value = g
        }
    }
}
