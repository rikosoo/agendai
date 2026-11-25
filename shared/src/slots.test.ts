import { describe, expect, it } from "vitest";
import { blocosDoAgendamento, diaDaSemana, horariosDisponiveis, somarDias } from "./slots";
import { ehData, validarServico } from "./validar";

const horario = { aberto: true, inicio: "09:00", fim: "11:00" };
const longe = { data: "2020-01-01", hora: "00:00" };

describe("slots", () => {
  it("calcula blocos por duração", () => {
    expect(blocosDoAgendamento("10:00", 45)).toEqual(["10:00", "10:30"]);
  });
  it("lista horários livres respeitando o fim do expediente", () => {
    const r = horariosDisponiveis({ horario, duracaoMin: 60, ocupados: [], data: "2030-01-07", agora: longe });
    expect(r).toEqual(["09:00", "09:30", "10:00"]);
  });
  it("remove horários que colidem com blocos ocupados", () => {
    const r = horariosDisponiveis({ horario, duracaoMin: 60, ocupados: ["09:30"], data: "2030-01-07", agora: longe });
    expect(r).toEqual(["10:00"]);
  });
  it("não oferece horários passados", () => {
    const r = horariosDisponiveis({ horario, duracaoMin: 30, ocupados: [], data: "2030-01-07", agora: { data: "2030-01-07", hora: "09:30" } });
    expect(r).toEqual(["10:00", "10:30"]);
  });
  it("dia fechado e datas passadas não têm horários", () => {
    expect(horariosDisponiveis({ horario: { ...horario, aberto: false }, duracaoMin: 30, ocupados: [], data: "2030-01-07", agora: longe })).toEqual([]);
    expect(horariosDisponiveis({ horario, duracaoMin: 30, ocupados: [], data: "2019-01-07", agora: longe })).toEqual([]);
  });
  it("datas", () => {
    expect(diaDaSemana("2026-11-25")).toBe(3);
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(ehData("2026-13-45")).toBe(false);
  });
  it("valida serviço", () => {
    expect(() => validarServico({ nome: "Corte", duracaoMin: 5, preco: 10 })).toThrow();
    expect(validarServico({ nome: "Corte", duracaoMin: 30, preco: "35.5" }).preco).toBe(35.5);
  });
});
