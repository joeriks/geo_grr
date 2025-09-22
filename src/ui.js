export class UIManager {
  constructor() {
    this.totalCountries = 0;
    this.totalCapitals = 0;

    this.container = document.createElement('div');
    this.container.id = 'hud';

    this.instructionsSection = document.createElement('section');
    this.instructionsSection.className = 'hud-section instructions';
    this.instructionsSection.innerHTML = `
      <h1>Europaexpedition</h1>
      <p>Använd WASD eller piltangenterna för att gå. Norr är uppåt på kartan.</p>
      <p>Varje ruta motsvarar ungefär 10×10 km. Håll dig på land för att undvika att simma!</p>
    `;

    this.progressSection = document.createElement('section');
    this.progressSection.className = 'hud-section progress';
    this.progressSection.innerHTML = `
      <div class="stat-block">
        <h2>Länder</h2>
        <p id="countries-count">0</p>
        <ul id="countries-list"></ul>
      </div>
      <div class="stat-block">
        <h2>Huvudstäder</h2>
        <p id="cities-count">0</p>
        <ul id="cities-list"></ul>
      </div>
    `;

    this.container.appendChild(this.instructionsSection);
    this.container.appendChild(this.progressSection);
    document.body.appendChild(this.container);

    this.countriesCount = this.progressSection.querySelector('#countries-count');
    this.citiesCount = this.progressSection.querySelector('#cities-count');
    this.countriesList = this.progressSection.querySelector('#countries-list');
    this.citiesList = this.progressSection.querySelector('#cities-list');
  }

  setTotals(totalCountries, totalCapitals) {
    this.totalCountries = totalCountries;
    this.totalCapitals = totalCapitals;
    this.#updateCounters(0, 0);
  }

  update(discovered) {
    const countries = Array.from(discovered.countries).sort();
    const capitals = Array.from(discovered.capitals).sort();

    this.#updateCounters(countries.length, capitals.length);

    this.#fillList(this.countriesList, countries);
    this.#fillList(this.citiesList, capitals);
  }

  #fillList(container, items) {
    container.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Inga ännu';
      container.appendChild(empty);
      return;
    }
    for (const entry of items) {
      const li = document.createElement('li');
      li.textContent = entry;
      container.appendChild(li);
    }
  }

  #updateCounters(countries, capitals) {
    const countriesTotal = this.totalCountries || 0;
    const capitalsTotal = this.totalCapitals || 0;
    this.countriesCount.textContent = `${countries} / ${countriesTotal}`;
    this.citiesCount.textContent = `${capitals} / ${capitalsTotal}`;
  }
}
