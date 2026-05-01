---
title: Weather Forecast
description:
  How to show tomorrow's high and low temperature from a Home Assistant weather entity.
---

# Weather Forecast

A Weather Forecast card shows tomorrow's expected high and low temperature from a Home Assistant `weather` entity.

It is intentionally simple: the label always says **Tomorrow**, and the main value shows the forecast high / low temperature, such as **18 / 10 °C**.

## Setting Up a Weather Forecast Card

1. Select a card and change its type to **Weather Forecast**.
2. Enter a **Weather Entity**, for example `weather.forecast_home`.

## How It Works on the Panel

- The card asks Home Assistant for the daily forecast for the configured weather entity.
- It uses tomorrow's daily forecast only.
- Its unit label comes from the panel's **Temperature Unit** setting.
- The card uses the **tertiary** colour from [Appearance](/features/appearance), like Sensor, Date, World Clock, and Weather cards.
- If the forecast is missing or unavailable, the card shows **-- / --** instead of leaving the card blank.

::: tip Home Assistant actions permission
This card needs the same **Allow the device to perform Home Assistant actions** setting as control cards. EspControl uses that permission to request forecast data from Home Assistant.
:::
