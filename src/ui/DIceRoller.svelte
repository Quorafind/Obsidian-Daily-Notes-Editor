<script lang="ts">
    let diceSides = 6;
    let numDice = 1;
    let modifier = 0;
    let result = 0;

    function randomNumber(min: number, max: number): number {
        return Math.floor(
            Math.random() * (max - min + 1) + min
        )
    }

    function rollDice(
        numDice: number,
        diceSides: number,
        modifier: number
    ): void {
        let temp = 0;

        for (let i = 0; i < numDice; i++) {
            temp += randomNumber(1, diceSides);
        }

        temp += modifier;

        result = temp;
    }


</script>

<div>
    <h1 class="H1">Dice Roller</h1>
    <br>
    <div class="Dice-Roller-Container">
        <input
            type="number"
            bind:value={diceSides}
        />
        D
        <input
            type="number"
            bind:value={numDice}
        />
        +
        <input
            type="number"
            bind:value={modifier}
        />
    </div>
    <br>
    <div class="Dice-Roller-Result">
        <span class="H4"> Result: {result} </span>
        <button class="Dice-Roller-Button" on:click={()=> rollDice(numDice, diceSides, modifier)}>
            Roll!
        </button>
    </div>
</div>

<style>
    .H1 {
        margin-left: auto;
        margin-right: auto;
        text-align: center;
    }

    .H4 {
        margin-left: auto;
        margin-right: auto;
        text-align: center;
    }

    .Dice-Roller-Result {
        margin-left: auto;
        margin-right: auto;
        text-align: center;
    }

    .Dice-Roller-Container {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .Dice-Roller-Button {
        margin-left: 4px;
    }

    .Dice-Roller-Button:hover {
        border: black 1px solid;
    }
</style>
