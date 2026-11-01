"""AI layer: grounded race reports and the "Ask the pit wall" assistant.

Everything here is built on the same payload builders the dashboard uses, so
every number in an answer is one the charts can show. A language model is
optional: without one, reports are written from templates and questions are
answered by a rule-based analyst that calls the same tools.
"""
