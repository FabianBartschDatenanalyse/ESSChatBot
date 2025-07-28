"use client"

import * as fs from 'fs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';

// This is a simple client-side text loader.
// In a real-world scenario, you might fetch this from an API endpoint
// that reads the file on the server.
const codebookText = `
Codebook
Datafile
ESS1 - integrated file, edition 6.7

doi:10.21338/ess1e06_7
Variables

    name - Title of dataset
    essround - ESS round
    edition - Edition
    proddate - Production date
    idno - Respondent's identification number
    cntry - Country
    dweight - Design weight
    pspwght - Post-stratification weight including design weight
    pweight - Population size weight (must be combined with dweight or pspwght)
    anweight - Analysis weight
    tvtot - TV watching, total time on average weekday
    tvpol - TV watching, news/politics/current affairs on average weekday
    rdtot - Radio listening, total time on average weekday
    rdpol - Radio listening, news/politics/current affairs on average weekday
    nwsptot - Newspaper reading, total time on average weekday
    nwsppol - Newspaper reading, politics/current affairs on average weekday
    netuse - Personal use of internet/e-mail/www
    ppltrst - Most people can be trusted or you can't be too careful
    pplfair - Most people try to take advantage of you, or try to be fair
    pplhlp - Most of the time people helpful or mostly looking out for themselves
    polintr - How interested in politics
    polcmpl - Politics too complicated to understand
    polactiv - Could take an active role in a group involved with political issues
    poldcs - Making mind up about political issues
    pltcare - Politicians in general care what people like respondent think
    pltinvt - Politicians interested in votes rather than peoples opinions
    trstlgl - Trust in the legal system
    trstplc - Trust in the police
    trstplt - Trust in politicians
    trstep - Trust in the European Parliament
    trstun - Trust in the United Nations
    trstprl - Trust in country's parliament
    vote - Voted last national election
    prtvtat - Party voted for in last national election, Austria
    prtvtbe - Party voted for in last national election, Belgium
    prtvtch - Party voted for in last national election, Switzerland
    prtvtcz - Party voted for in last national election, Czechia
    prtvde1 - Party voted for in last national election 1, Germany
    prtvde2 - Party voted for in last national election 2, Germany
    prtvtdk - Party voted for in last national election, Denmark
    prtvtes - Party voted for in last national election, Spain
    prtvtfi - Party voted for in last national election, Finland
    prtvtfr - Party voted for in last national election, France (ballot 1)
    prtvtgb - Party voted for in last national election, United Kingdom
    prtvtgr - Party voted for in last national election, Greece
    prtvthu - Party voted for in last national election, Hungary
    prtvtie - Party voted for in last national election, Ireland
    prtvtil - Party voted for in last national election, Israel
    prtvtit - Party voted for in last national election, Italy
    prtvtlu - Party voted for in last national election, Luxembourg
    prtvtnl - Party voted for in last national election, Netherlands
    prtvtno - Party voted for in last national election, Norway
    prtvtpl - Party voted for in last national election, Poland
    prtvtpt - Party voted for in last national election, Portugal
    prtvtse - Party voted for in last national election, Sweden
    prtvtsi - Party voted for in last national election, Slovenia
    contplt - Contacted politician or government official last 12 months
    wrkprty - Worked in political party or action group last 12 months
    wrkorg - Worked in another organisation or association last 12 months
    badge - Worn or displayed campaign badge/sticker last 12 months
    sgnptit - Signed petition last 12 months
    pbldmn - Taken part in lawful public demonstration last 12 months
    bctprd - Boycotted certain products last 12 months
    bghtprd - Bought product for political/ethical/environment reason last 12 months
    dntmny - Donated money to political organisation or group last 12 months
    ilglpst - Participated illegal protest activities last 12 months
    clsprty - Feel closer to a particular party than all other parties
    prtclat - Which party feel closer to, Austria
    prtclbe - Which party feel closer to, Belgium
    prtclch - Which party feel closer to, Switzerland
    prtclcz - Which party feel closer to, Czechia
    prtclde - Which party feel closer to, Germany
    prtcldk - Which party feel closer to, Denmark
    prtcles - Which party feel closer to, Spain
    prtclfi - Which party feel closer to, Finland
    prtclfr - Which party feel closer to, France
    prtclgb - Which party feel closer to, United Kingdom
    prtclgr - Which party feel closer to, Greece
    prtclhu - Which party feel closer to, Hungary
    prtclie - Which party feel closer to, Ireland
    prtclil - Which party feel closer to, Israel
    prtclit - Which party feel closer to, Italy
    prtcllu - Which party feel closer to, Luxembourg
    prtclnl - Which party feel closer to, Netherlands
    prtclno - Which party feel closer to, Norway
    prtclpl - Which party feel closer to, Poland
    prtclpt - Which party feel closer to, Portugal
    prtclse - Which party feel closer to, Sweden
    prtclsi - Which party feel closer to, Slovenia
    prtdgcl - How close to party
    mmbprty - Member of political party
    prtmbat - Member of which party, Austria
    prtmbbe - Member of which party, Belgium
    prtmbch - Member of which party, Switzerland
    prtmbcz - Member of which party, Czechia
    prtmbde - Member of which party, Germany
    prtmbdk - Member of which party, Denmark
    prtmbes - Member of which party, Spain
    prtmbfi - Member of which party, Finland
    prtmbfr - Member of which party, France
    prtmbgb - Member of which party, United Kingdom
    prtmbgr - Member of which party, Greece
    prtmbhu - Member of which party, Hungary
    prtmbie - Member of which party, Ireland
    prtmbil - Member of which party, Israel
    prtmbit - Member of which party, Italy
    prtmblu - Member of which party, Luxembourg
    prtmbnl - Member of which party, Netherlands
    prtmbno - Member of which party, Norway
    prtmbpl - Member of which party, Poland
    prtmbpt - Member of which party, Portugal
    prtmbse - Member of which party, Sweden
    prtmbsi - Member of which party, Slovenia
    lrscale - Placement on left right scale
    stflife - How satisfied with life as a whole
    stfeco - How satisfied with present state of economy in country
    stfgov - How satisfied with the national government
    stfdem - How satisfied with the way democracy works in country
    stfedu - State of education in country nowadays
    stfhlth - State of health services in country nowadays
    dclenv - Preferred decision level of environmental protection policies
    dclcrm - Preferred decision level of fighting against organised crime policies
    dclagr - Preferred decision level of agricultural policies
    dcldef - Preferred decision level of defence policies
    dclwlfr - Preferred decision level of social welfare policies
    dclaid - Preferred decision level of policies about aid to developing countries
    dclmig - Preferred decision level of immigration and refugees policies
    dclintr - Preferred decision level of interest rates policies
    ginveco - The less government intervenes in economy, the better for country
    gincdif - Government should reduce differences in income levels
    needtru - Employees need strong trade unions to protect work conditions/wages
    freehms - Gays and lesbians free to live life as they wish
    lawobey - The law should always be obeyed
    prtyban - Ban political parties that wish overthrow democracy
    ecohenv - Economic growth always ends up harming environment
    scnsenv - Modern science can be relied on to solve environmental problems
    happy - How happy are you
    sclmeet - How often socially meet with friends, relatives or colleagues
    inmdisc - Anyone to discuss intimate and personal matters with
    sclact - Take part in social activities compared to others of same age
    crmvct - Respondent or household member victim of burglary/assault last 5 years
    aesfdrk - Feeling of safety of walking alone in local area after dark
    health - Subjective general health
    hlthhmp - Hampered in daily activities by illness/disability/infirmity/mental problem
    rlgblg - Belonging to particular religion or denomination
    rlgdnm - Religion or denomination belonging to at present
    rlgblge - Ever belonging to particular religion or denomination
    rlgdnme - Religion or denomination belonging to in the past
    rlgdgr - How religious are you
    rlgatnd - How often attend religious services apart from special occasions
    pray - How often pray apart from at religious services
    dscrgrp - Member of a group discriminated against in this country
    dscrrce - Discrimination of respondent's group: colour or race
    dscrntn - Discrimination of respondent's group: nationality
    dscrrlg - Discrimination of respondent's group: religion
    dscrlng - Discrimination of respondent's group: language
    dscretn - Discrimination of respondent's group: ethnic group
    dscrage - Discrimination of respondent's group: age
    dscrgnd - Discrimination of respondent's group: gender
    dscrsex - Discrimination of respondent's group: sexuality
    dscrdsb - Discrimination of respondent's group: disability
    dscroth - Discrimination of respondent's group: other grounds
    dscrdk - Discrimination of respondent's group: don't know
    dscrref - Discrimination of respondent's group: refusal
    dscrnap - Discrimination of respondent's group: not applicable
    dscrna - Discrimination of respondent's group: no answer
    ctzcntr - Citizen of country
    ctzship - Citizenship
    brncntr - Born in country
    cntbrth - Country of birth
    livecntr - How long ago first came to live in country
    lnghoma - Language most often spoken at home: first mentioned
    lnghomb - Language most often spoken at home: second mentioned
    blgetmg - Belong to minority ethnic group in country
    facntr - Father born in country
    facntn - Continent of birth, father
    mocntr - Mother born in country
    mocntn - Continent of birth, mother
    imgetn - Most immigrants to country of same race/ethnic group as majority
    eimgrpc - Immigrants from Europe: most from rich/poor countries
    imgrpc - Immigrants from outside Europe: from rich/poor countries
    imsmetn - Allow many/few immigrants of same race/ethnic group as majority
    imdfetn - Allow many/few immigrants of different race/ethnic group from majority
    eimrcnt - Allow many/few immigrants from richer countries in Europe
    eimpcnt - Allow many/few immigrants from poorer countries in Europe
    imrcntr - Allow many/few immigrants from richer countries outside Europe
    impcntr - Allow many/few immigrants from poorer countries outside Europe
    qfimedu - Qualification for immigration: good educational qualifications
    qfimfml - Qualification for immigration: close family living here
    qfimlng - Qualification for immigration: speak country's official language
    qfimchr - Qualification for immigration: christian background
    qfimwht - Qualification for immigration: be white
    qfimwlt - Qualification for immigration: be wealthy
    qfimwsk - Qualification for immigration: work skills needed in country
    qfimcmt - Qualification for immigration: committed to way of life in country
    imwgdwn - Average wages/salaries generally brought down by immigrants
    imhecop - Immigrants harm economic prospects of the poor more than the rich
    imfljob - Immigrants help to fill jobs where there are shortage of workers
    imunplv - If immigrants are long term unemployed they should be made to leave
    imsmrgt - Immigrants should be given same rights as everyone else
    imscrlv - If immigrants commit serious crime they should be made to leave
    imacrlv - If immigrants commit any crime they should be made to leave
    imtcjob - Immigrants take jobs away in country or create new jobs
    imbleco - Taxes and services: immigrants take out more than they put in or less
    imbgeco - Immigration bad or good for country's economy
    imueclt - Country's cultural life undermined or enriched by immigrants
    imwbcnt - Immigrants make country worse or better place to live
    imwbcrm - Immigrants make country's crime problems worse or better
    imbghct - Immigration to country bad or good for home countries in the long run
    ctbfsmv - All countries benefit if people can move where their skills needed
    imrsprc - Richer countries responsible to accept people from poorer countries
    imsetbs - Immigrant same race/ethnic group majority: your boss
    imsetmr - Immigrant same race/ethnic group majority: married close relative
    imdetbs - Immigrant different race/ethnic group majority: your boss
    imdetmr - Immigrant different race/ethnic group majority: married close relative
    idetalv - People of minority race/ ethnic group in ideal living area
    acetalv - People of minority race/ ethnic group in current living area
    pplstrd - Better for a country if almost everyone share customs and traditions
    vrtrlg - Better for a country if a variety of different religions
    comnlng - Better for a country if almost everyone speak one common language
    alwspsc - Immigrant communities should be allowed separate schools
    stimrdt - If a country wants to reduce tension it should stop immigration
    lwdscwp - Law against ethnic discrimination in workplace good/bad for a country
    lwpeth - Law against promoting racial or ethnic hatred good/bad for a country
    imgfrnd - Any immigrant friends
    imgclg - Any immigrant colleagues
    shrrfg - Country has more than its fair share of people applying refugee status
    rfgawrk - People applying refugee status allowed to work while cases considered
    gvrfgap - Government should be generous judging applications for refugee status
    rfgfrpc - Most refugee applicants not in real fear of persecution own countries
    rfgdtcn - Refugee applicants kept in detention centres while cases considered
    rfggvfn - Financial support to refugee applicants while cases considered
    rfgbfml - Granted refugees should be entitled to bring close family members
    noimbro - Of every 100 people in country how many born outside country
    cpimpop - Country's number of immigrants compared to European countries same size
    blncmig - Number of people leaving country compared to coming in
    sptcref - Sports/outdoor activity club, last 12 months: refusal
    sptcna - Sports/outdoor activity club, last 12 months: no answer
    sptcnn - Sports/outdoor activity club, last 12 months: none apply
    sptcmmb - Sports/outdoor activity club, last 12 months: member
    sptcptp - Sports/outdoor activity club, last 12 months: participated
    sptcdm - Sports/outdoor activity club, last 12 months: donated money
    sptcvw - Sports/outdoor activity club, last 12 months: voluntary work
    sptcfrd - Personal friends in sports/outdoor activity club
    cltofrd - Personal friends in cultural/hobby activity organisation
    trufrd - Personal friends in trade union
    prfofrd - Personal friends in business /profession/farmers organisation
    cnsofrd - Personal friends in consumer/automobile organisation
    hmnofrd - Personal friends in humanitarian organisation etc
    epaofrd - Personal friends in environmental/peace/animal organisation
    rlgofrd - Personal friends in religious/church organisation
    prtyfrd - Personal friends in political party
    setofrd - Personal friends in science/education/teacher organisation
    sclcfrd - Personal friends in social club etc.
    othvfrd - Personal friends in other voluntary organisation
    cltoref - Cultural/hobby activity organisation, last 12 months: refusal
    cltona - Cultural/hobby activity organisation, last 12 months: no answer
    cltonn - Cultural/hobby activity organisation, last 12 months: none apply
    cltommb - Cultural /hobby activity organisation, last 12 months: member
    cltoptp - Cultural/hobby activity organisation, last 12 months: participated
    cltodm - Cultural/hobby activity organisation, last 12 months: donated money
    cltovw - Cultural/hobby activity organisation, last 12 months: voluntary work
    truref - Trade union, last 12 months: refusal
    truna - Trade union, last 12 months: no answer
    trunn - Trade union, last 12 months: none apply
    trummb - Trade union, last 12 months: member
    truptp - Trade union, last 12 months: participated
    trudm - Trade union, last 12 months: donated money
    truvw - Trade union, last 12 months: voluntary work
    prforef - Business/profession/farmers organisation, last 12 months: refusal
    prfona - Business/profession/farmers organisation, last 12 months: no answer
    prfonn - Business/profession/farmers organisation, last 12 months: none apply
    prfommb - Business/profession/farmers organisation, last 12 months: member
    prfoptp - Business/profession/farmers organisation, last 12 months: participated
    prfodm - Business/profession/farmer organisation, last 12 months: donated money
    prfovw - Business/profession/farmer organisation last 12 months: voluntary work
    cnsoref - Consumer/automobile organisation, last 12 months: refusal
    cnsona - Consumer/automobile organisation, last 12 months: no answer
    cnsonn - Consumer/automobile organisation, last 12 months: none apply
    cnsommb - Consumer/automobile organisation, last 12 months: member
    cnsoptp - Consumer/automobile organisation, last 12 months: participated
    cnsodm - Consumer/automobile organisation, last 12 months: donated money
    cnsovw - Consumer/automobile organisation, last 12 months: voluntary work
    hmnoref - Humanitarian organisation etc., last 12 months: refusal
    hmnona - Humanitarian organisation etc., last 12 months: no answer
    hmnonn - Humanitarian organisation etc., last 12 months: none apply
    hmnommb - Humanitarian organisation etc., last 12 months: member
    hmnoptp - Humanitarian organisation etc., last 12 months: participated
    hmnodm - Humanitarian organisation etc., last 12 months: donated money
    hmnovw - Humanitarian organisation etc., last 12 months: voluntary work
    epaoref - Environmental/peace/animal organisation, last 12 months: refusal
    epaona - Environment/peace/animal organisation, last 12 months: no answer
    epaonn - Environmental/peace/animal organisation, last 12 months: none apply
    epaommb - Environmental/peace/animal organisation, last 12 months: member
    epaoptp - Environmental/peace/animal organisation, last 12 months: participated
    epaodm - Environmental/peace/animal organisation, last 12 months: donated money
    epaovw - Environment/peace/animal organisation, last 12 months: voluntary work
    rlgoref - Religious/church organisation, last 12 months: refusal
    rlgona - Religious/church organisation, last 12 months: no answer
    rlgonn - Religious/church organisation, last 12 months: none apply
    rlgommb - Religious/church organisation, last 12 months: member
    rlgoptp - Religious/church organisation, last 12 months: participated
    rlgodm - Religious/church organisation, last 12 months: donated money
    rlgovw - Religious/church organisation, last 12 months: voluntary work
    prtyref - Political party, last 12 months: refusal
    prtyna - Political party, last 12 months: no answer
    prtynn - Political party, last 12 months: none apply
    prtymmb - Political party, last 12 months: member
    prtyptp - Political party, last 12 months: participated
    prtydm - Political party, last 12 months: donated money
    prtyvw - Political party, last 12 months: voluntary work
    setoref - Science/education/teacher organisation, last 12 months: refusal
    setona - Science/education/teacher organisation, last 12 months: no answer
    setonn - Science/education/teacher organisation, last 12 months: none apply
    setommb - Science/education/teacher organisation, last 12 months: member
    setoptp - Science/education/teacher organisation, last 12 months: participated
    setodm - Science/education/teacher organisation, last 12 months: donated money
    setovw - Science/education/teacher organisation, last 12 months: voluntary work
    sclcref - Social club etc., last 12 months: refusal
    sclcna - Social club etc., last 12 months: no answer
    sclcnn - Social club etc., last 12 months: none apply
    sclcmmb - Social club etc., last 12 months: member
    sclcptp - Social club etc., last 12 months: participated
    sclcdm - Social club etc., last 12 months: donated money
    sclcvw - Social club etc., last 12 months: voluntary work
    othvref - Other voluntary organisation, last 12 months: refusal
    othvna - Other voluntary organisation, last 12 months: no answer
    othvnn - Other voluntary organisation, last 12 months: none apply
    othvmmb - Other voluntary organisation, last 12 months: member
    othvptp - Other voluntary organisation, last 12 months: participated
    othvdm - Other voluntary organisation, last 12 months: donated money
    othvvw - Other voluntary organisation, last 12 months: voluntary work
    impfml - Important in life: family
    impfrds - Important in life: friends
    implsrt - Important in life: leisure time
    imppol - Important in life: politics
    impwrk - Important in life: work
    imprlg - Important in life: religion
    impvo - Important in life: voluntary organisations
    hlpppl - Help others not counting work/voluntary organisations, how often
    discpol - Discuss politics/current affairs, how often
    impsppl - To be a good citizen: how important to support people worse off
    impvote - To be a good citizen: how important to vote in elections
    impoblw - To be a good citizen: how important to always obey laws/regulations
    impopin - To be a good citizen: how important to form independent opinion
    impavo - Good citizen: how important to be active in voluntary organisations
    impapol - To be a good citizen: how important to be active in politics
    yrlvdae - How long lived in this area
    empl - Employment status
    wrkflex - Allowed to be flexible in working hours
    wkdcorg - Allowed to decide how daily work is organised
    wkenvin - Allowed to influence job environment
    wkdcsin - Allowed to influence decisions about work direction
    wkchtsk - Allowed to change work tasks
    smbtjob - Get a similar or better job with another employer
    strtbsn - Start own business
    truwrkp - Trade union at workplace
    trusay - Difficult or easy to have a say in actions taken by trade union
    truiwkp - Difficult or easy for trade union influence conditions at workplace
    stfhwkp - Satisfaction with the way things handled at workplace last 12 months
    imprwkc - Attempted to improve work conditions last 12 months
    imprwcr - Did any improvement of work conditions result from the attempt
    imprwct - Fairly or unfairly treated in attempt to improve things at work
    hhmmb - Number of people living regularly as member of household
    gndr - Gender
    gndr2 - Gender of second person in household
    gndr3 - Gender of third person in household
    gndr4 - Gender of fourth person in household
    gndr5 - Gender of fifth person in household
    gndr6 - Gender of sixth person in household
    gndr7 - Gender of seventh person in household
    gndr8 - Gender of eighth person in household
    gndr9 - Gender of ninth person in household
    gndr10 - Gender of tenth person in household
    gndr11 - Gender of eleventh person in household
    gndr12 - Gender of twelfth person in household
    gndr13 - Gender of thirteenth person in household
    gndr14 - Gender of fourteenth person in household
    gndr15 - Gender of fifteenth person in household
    yrbrn - Year of birth
    agea - Age of respondent, calculated
    yrbrn2 - Year of birth of second person in household
    yrbrn3 - Year of birth of third person in household
    yrbrn4 - Year of birth of fourth person in household
    yrbrn5 - Year of birth of fifth person in household
    yrbrn6 - Year of birth of sixth person in household
    yrbrn7 - Year of birth of seventh person in household
    yrbrn8 - Year of birth of eighth person in household
    yrbrn9 - Year of birth of ninth person in household
    yrbrn10 - Year of birth of tenth person in household
    yrbrn11 - Year of birth of eleventh person in household
    yrbrn12 - Year of birth of twelfth person in household
    yrbrn13 - Year of birth of thirteenth person in household
    yrbrn14 - Year of birth of fourteenth person in household
    yrbrn15 - Year of birth of fifteenth person in household
    rship2 - Second person in household: relationship to respondent
    rship3 - Third person in household: relationship to respondent
    rship4 - Fourth person in household: relationship to respondent
    rship5 - Fifth person in household: relationship to respondent
    rship6 - Sixth person in household: relationship to respondent
    rship7 - Seventh person in household: relationship to respondent
    rship8 - Eighth person in household: relationship to respondent
    rship9 - Ninth person in household: relationship to respondent
    rship10 - Tenth person in household: relationship to respondent
    rship11 - Eleventh person in household: relationship to respondent
    rship12 - Twelfth person in household: relationship to respondent
    rship13 - Thirteenth person in household: relationship to respondent
    rship14 - Fourteenth person in household: relationship to respondent
    rship15 - Fifteenth person in household: relationship to respondent
    domicil - Domicile, respondent's description
    edulvla - Highest level of education
    eisced - Highest level of education, ES - ISCED
    edlvbe - Highest level of education, Belgium
    edlvch - Highest level of education, Switzerland
    edlvcz - Highest level of education, Czechia
    edlvdk - Highest level of education, Denmark
    edlves - Highest level of education, Spain
    edlvfr - Highest level of education, France
    edlvgb - Highest level of education, United Kingdom
    edlvgr - Highest level of education, Greece
    edlvhu - Highest level of education, Hungary
    edlvie - Highest level of education, Ireland
    edlvil - Highest level of education, Israel
    edlvit - Highest level of education, Italy
    edlvlu - Highest level of education, Luxembourg
    edlvnl - Highest level of education, Netherlands
    edlvno - Highest level of education, Norway
    edlvpl - Highest level of education, Poland
    edlvpt - Highest level of education, Portugal
    edlvse - Highest level of education, Sweden
    eduyrs - Years of full-time education completed
    dngdk - Doing last 7 days: don't know
    dngref - Doing last 7 days: refusal
    dngna - Doing last 7 days: no answer
    pdwrk - Doing last 7 days: paid work
    edctn - Doing last 7 days: education
    uempla - Doing last 7 days: unemployed, actively looking for job
    uempli - Doing last 7 days: unemployed, not actively looking for job
    dsbld - Doing last 7 days: permanently sick or disabled
    rtrd - Doing last 7 days: retired
    cmsrv - Doing last 7 days: community or military service
    hswrk - Doing last 7 days: housework, looking after children, others
    dngoth - Doing last 7 days: other
    mainact - Main activity last 7 days
    mnactic - Main activity, last 7 days. All respondents. Post coded
    crpdwk - Control paid work last 7 days
    pdjobev - Ever had a paid job
    pdjobyr - Year last in paid job
    emplrel - Employment relation
    emplno - Number of employees respondent has/had
    wrkctr - Employment contract unlimited or limited duration
    wrkctrhu - Employment contract unlimited or limited duration, Hungary
    estsz - Establishment size
    jbspv - Responsible for supervising other employees
    njbspv - Number of people responsible for in job
    orgwrk - To what extent organise own work
    wkhct - Total contracted hours per week in main job overtime excluded
    wkhtot - Total hours normally worked per week in main job overtime included
    iscoco - Occupation, ISCO88 (com)
    nacer1 - Industry, NACE rev.1
    uemp3m - Ever unemployed and seeking work for a period more than three months
    uemp12m - Any period of unemployment and work seeking lasted 12 months or more
    uemp5yr - Any period of unemployment and work seeking within last 5 years
    mbtru - Member of trade union or similar organisation
    hincsrc - Main source of household income
    hinctnt - Household's total net income, all sources
    hincfel - Feeling about household's income nowadays
    brwmny - Borrow money to make ends meet, difficult or easy
    partner - Lives with husband/wife/partner at household grid
    edulvlpa - Partner's highest level of education
    dngdkp - Partner doing last 7 days: don't know
    dngrefp - Partner doing last 7 days: refusal
    dngnapp - Partner doing last 7 days: not applicable
    dngnap - Partner doing last 7 days: no answer
    pdwrkp - Partner doing last 7 days: paid work
    edctnp - Partner doing last 7 days: education
    uemplap - Partner doing last 7 days: unemployed, actively looking for job
    uemplip - Partner doing last 7 days: unemployed, not actively looking for job
    dsbldp - Partner doing last 7 days: permanently sick or disabled
    rtrdp - Partner doing last 7 days: retired
    cmsrvp - Partner doing last 7 days: community or military service
    hswrkp - Partner doing last 7 days: housework, looking after children, others
    dngothp - Partner doing last 7 days: other
    mnactp - Partner's main activity last 7 days
    crpdwkp - Partner, control paid work last 7 days
    iscocop - Occupation partner, ISCO88 (com)
    emprelp - Partner's employment relation
    emplnop - Number of employees partner has
    jbspvp - Partner responsible for supervising other employees
    njbspvp - Number of people partner responsible for in job
    wkhtotp - Hours normally worked a week in main job overtime included, partner
    edulvlfa - Father's highest level of education
    emprf14 - Father's employment status when respondent 14
    emplnof - Number of employees father had
    jbspvf - Father responsible for supervising other employees
    occf14 - Father's occupation when respondent 14
    occf14ie - Father's occupation when respondent 14, Ireland
    edulvlma - Mother's highest level of education
    emprm14 - Mother's employment status when respondent 14
    emplnom - Number of employees mother had
    jbspvm - Mother responsible for supervising other employees
    occm14 - Mother's occupation when respondent 14
    occm14ie - Mother's occupation when respondent 14, Ireland
    atncrse - Improve knowledge/skills: course/lecture/conference, last 12 months
    marital - Legal marital status
    martlfr - Legal marital status, France
    lvghw - Currently living with husband/wife
    lvgoptn - Currently living with another partner than husband/wife
    lvgptn - Currently living with partner
    lvgptne - Ever lived with a partner without being married
    dvrcdev - Ever been divorced
    chldhm - Children living at home or not
    chldhhe - Ever had children living in household
    regionat - Region, Austria
    regionbe - Region, Belgium
    regioach - Region, Switzerland
    regioncz - Region, Czechia
    regionde - Region, Germany
    regiondk - Region, Denmark
    regiones - Region, Spain
    regionfi - Region, Finland
    regionfr - Region, France
    regiongb - Region, United Kingdom
    regiongr - Region, Greece
    regionhu - Region, Hungary
    regionie - Region, Ireland
    regionil - Region, Israel
    regionit - Region, Italy
    regionlu - Region, Luxembourg
    regionnl - Region, Netherlands
    regionno - Region, Norway
    regionpl - Region, Poland
    regionpt - Region, Portugal
    regionse - Region, Sweden
    regionsi - Region, Slovenia
    intewde - Place of interview: East, West Germany
    ipcrtiv - Important to think new ideas and being creative
    imprich - Important to be rich, have money and expensive things
    ipeqopt - Important that people are treated equally and have equal opportunities
    ipshabt - Important to show abilities and be admired
    impsafe - Important to live in secure and safe surroundings
    impdiff - Important to try new and different things in life
    ipfrule - Important to do what is told and follow rules
    ipudrst - Important to understand different people
    ipmodst - Important to be humble and modest, not draw attention
    ipgdtim - Important to have a good time
    impfree - Important to make own decisions and be free
    iphlppl - Important to help people and care for others well-being
    ipsuces - Important to be successful and that people recognize achievements
    ipstrgv - Important that government is strong and ensures safety
    ipadvnt - Important to seek adventures and have an exciting life
    ipbhprp - Important to behave properly
    iprspot - Important to get respect from others
    iplylfr - Important to be loyal to friends and devote to people close
    impenv - Important to care for nature and environment
    imptrad - Important to follow traditions and customs
    impfun - Important to seek fun and things that give pleasure
    inwdd - Day of month of interview
    inwmm - Month of interview
    inwyr - Year of interview
    inwshh - Start of interview, hour
    inwsmm - Start of interview, minute
    inwemm - End of interview, minute
    inwehh - End of interview, hour
    inwtm - Interview length in minutes, main questionnaire
    spltadm - Administration of split ballot and MTMM
    supqadm - Administration of supplementary questionnaire

name
Title of dataset
essround
ESS round
edition
Edition
proddate
Production date
idno
Respondent's identification number
cntry
Country
Value 	Category
AL 	Albania
AT 	Austria
BE 	Belgium
BG 	Bulgaria
CH 	Switzerland
CY 	Cyprus
CZ 	Czechia
DE 	Germany
DK 	Denmark
EE 	Estonia
ES 	Spain
FI 	Finland
FR 	France
GB 	United Kingdom
GE 	Georgia
GR 	Greece
HR 	Croatia
HU 	Hungary
IE 	Ireland
IS 	Iceland
IL 	Israel
IT 	Italy
LT 	Lithuania
LU 	Luxembourg
LV 	Latvia
ME 	Montenegro
MK 	North Macedonia
NL 	Netherlands
NO 	Norway
PL 	Poland
PT 	Portugal
RO 	Romania
RS 	Serbia
RU 	Russian Federation
SE 	Sweden
SI 	Slovenia
SK 	Slovakia
TR 	Turkey
UA 	Ukraine
XK 	Kosovo
dweight
Design weight
pspwght
Post-stratification weight including design weight
pweight
Population size weight (must be combined with dweight or pspwght)
anweight
Analysis weight
tvtot
TV watching, total time on average weekday
CARD 1
On an average weekday, how much time, in total, do you spend watching television?
Please use this card to answer
Value 	Category
0 	No time at all
1 	Less than 0,5 hour
2 	0,5 hour to 1 hour
3 	More than 1 hour, up to 1,5 hours
4 	More than 1,5 hours, up to 2 hours
5 	More than 2 hours, up to 2,5 hours
6 	More than 2,5 hours, up to 3 hours
7 	More than 3 hours
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
tvpol
TV watching, news/politics/current affairs on average weekday
STILL CARD 1
And again on an average weekday, how much of your time watching television is spent watching news or programmes about politics and current affairs?
Still use this card
Value 	Category
0 	No time at all
1 	Less than 0,5 hour
2 	0,5 hour to 1 hour
3 	More than 1 hour, up to 1,5 hours
4 	More than 1,5 hours, up to 2 hours
5 	More than 2 hours, up to 2,5 hours
6 	More than 2,5 hours, up to 3 hours
7 	More than 3 hours
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
rdtot
Radio listening, total time on average weekday
ASK ALL. STILL CARD 1
On an average weekday, how much time, in total, do you spend listening to the radio?
Use the same card
Value 	Category
0 	No time at all
1 	Less than 0,5 hour
2 	0,5 hour to 1 hour
3 	More than 1 hour, up to 1,5 hours
4 	More than 1,5 hours, up to 2 hours
5 	More than 2 hours, up to 2,5 hours
6 	More than 2,5 hours, up to 3 hours
7 	More than 3 hours
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
rdpol
Radio listening, news/politics/current affairs on average weekday
STILL CARD 1
And again on an average weekday, how much of your time listening to the radio is spent listening to news or programmes about politics and current affairs?
Still use this card
Value 	Category
0 	No time at all
1 	Less than 0,5 hour
2 	0,5 hour to 1 hour
3 	More than 1 hour, up to 1,5 hours
4 	More than 1,5 hours, up to 2 hours
5 	More than 2 hours, up to 2,5 hours
6 	More than 2,5 hours, up to 3 hours
7 	More than 3 hours
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
nwsptot
Newspaper reading, total time on average weekday
ASK ALL. STILL CARD 1
On an average weekday, how much time, in total, do you spend reading the newspapers?
Use this card again
Value 	Category
0 	No time at all
1 	Less than 0,5 hour
2 	0,5 hour to 1 hour
3 	More than 1 hour, up to 1,5 hours
4 	More than 1,5 hours, up to 2 hours
5 	More than 2 hours, up to 2,5 hours
6 	More than 2,5 hours, up to 3 hours
7 	More than 3 hours
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
nwsppol
Newspaper reading, politics/current affairs on average weekday
STILL CARD 1
And how much of this time is spent reading about politics and current affairs?
Still use this card
Value 	Category
0 	No time at all
1 	Less than 0,5 hour
2 	0,5 hour to 1 hour
3 	More than 1 hour, up to 1,5 hours
4 	More than 1,5 hours, up to 2 hours
5 	More than 2 hours, up to 2,5 hours
6 	More than 2,5 hours, up to 3 hours
7 	More than 3 hours
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
netuse
Personal use of internet/e-mail/www
ASK ALL. CARD 2
Now, using this card, how often do you use the internet, the World Wide Web or e-mail - whether at home or at work - for your personal use?
Value 	Category
0 	No access at home or work
1 	Never use
2 	Less than once a month
3 	Once a month
4 	Several times a month
5 	Once a week
6 	Several times a week
7 	Every day
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
ppltrst
Most people can be trusted or you can't be too careful
CARD 3
Using this card, generally speaking, would you say that most people can be trusted, or that you can't be too careful in dealing with people? Please tell me on a score of 0 to 10, where 0 means you can't be too careful and 10 means that most people can be trusted.
Value 	Category
0 	You can't be too careful
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Most people can be trusted
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
pplfair
Most people try to take advantage of you, or try to be fair
CARD 4
Using this card, do you think that most people would try to take advantage of you if they got the chance, or would they try to be fair?
Value 	Category
0 	Most people try to take advantage of me
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Most people try to be fair
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
pplhlp
Most of the time people helpful or mostly looking out for themselves
CARD 5
Would you say that most of the time people try to be helpful or that they are mostly looking out for themselves?
Please use this card
Value 	Category
0 	People mostly look out for themselves
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	People mostly try to be helpful
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
polintr
How interested in politics
How interested would you say you are in politics - are you...
Value 	Category
1 	Very interested
2 	Quite interested
3 	Hardly interested
4 	Not at all interested
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
polcmpl
Politics too complicated to understand
CARD 6
How often does politics seem so complicated that you can't really understand what is going on?
Please use this card
Value 	Category
1 	Never
2 	Seldom
3 	Occasionally
4 	Regularly
5 	Frequently
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
polactiv
Could take an active role in a group involved with political issues
CARD 7
Do you think that you could take an active role in a group involved with political issues?
Please use this card
Value 	Category
1 	Definitely not
2 	Probably not
3 	Not sure either way
4 	Probably
5 	Definitely
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
poldcs
Making mind up about political issues
CARD 8
How difficult or easy do you find it to make your mind up about political issues?
Please use this card
Value 	Category
1 	Very difficult
2 	Difficult
3 	Neither difficult nor easy
4 	Easy
5 	Very easy
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
pltcare
Politicians in general care what people like respondent think
CARD 9
Using this card, do you think that politicians in general care what people like you think?
Value 	Category
1 	Hardly any politicians care
2 	Very few care
3 	Some care
4 	Many care
5 	Most politicians care
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
pltinvt
Politicians interested in votes rather than peoples opinions
CARD 10
Would you say that politicians are just interested in getting people's votes rather than in people's opinions?
Please use this card
Value 	Category
1 	Nearly all just interested in votes
2 	Most just interested in votes
3 	Some just interested in votes
4 	Most interested in opinions
5 	Nearly all interested in opinions
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
trstlgl
Trust in the legal system
CARD 11
Using this card, please tell me on a score of 0-10 how much you personally trust each of the institutions I read out. 0 means you do not trust an institution at all, and 10 means you have complete trust. Firstly... ...the legal system?
READ OUT
Value 	Category
0 	No trust at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Complete trust
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
trstplc
Trust in the police
CARD 11
Using this card, please tell me on a score of 0-10 how much you personally trust each of the institutions I read out. 0 means you do not trust an institution at all, and 10 means you have complete trust. Firstly... ...the police?
READ OUT
Value 	Category
0 	No trust at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Complete trust
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
trstplt
Trust in politicians
CARD 11
Using this card, please tell me on a score of 0-10 how much you personally trust each of the institutions I read out. 0 means you do not trust an institution at all, and 10 means you have complete trust. Firstly... ...politicians?
READ OUT
Value 	Category
0 	No trust at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Complete trust
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
trstep
Trust in the European Parliament
CARD 11
Using this card, please tell me on a score of 0-10 how much you personally trust each of the institutions I read out. 0 means you do not trust an institution at all, and 10 means you have complete trust. Firstly... ...the European Parliament?
READ OUT
Value 	Category
0 	No trust at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Complete trust
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
trstun
Trust in the United Nations
CARD 11
Using this card, please tell me on a score of 0-10 how much you personally trust each of the institutions I read out. 0 means you do not trust an institution at all, and 10 means you have complete trust. Firstly... ...the United Nations?
READ OUT
Value 	Category
0 	No trust at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Complete trust
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
trstprl
Trust in country's parliament
CARD 11
Using this card, please tell me on a score of 0-10 how much you personally trust each of the institutions I read out. 0 means you do not trust an institution at all, and 10 means you have complete trust. Firstly... ...[country]'s parliament?
READ OUT
Value 	Category
0 	No trust at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Complete trust
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
vote
Voted last national election
Some people don't vote nowadays for one reason or another. Did you vote in the last [country] national election in [month/year]?
Value 	Category
1 	Yes
2 	No
3 	Not eligible to vote
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
prtvtat
Party voted for in last national election, Austria
Which party did you vote for in that election? (Austria)
Value 	Category
1 	SPÖ
2 	ÖVP
3 	FPÖ
4 	Grüne
5 	LIF
6 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtbe
Party voted for in last national election, Belgium
Which party did you vote for in that election? (Belgium)
Value 	Category
1 	Agalev
2 	CVP
3 	SP
4 	PNPB
5 	VLD
6 	VU-ID
7 	PVDA-AE
8 	Vlaams Blok
9 	VIVANT
11 	ECOLO
12 	PSC
13 	PRL-FDF
14 	PS
15 	FRONT NATIONAL
16 	PTB-UA
17 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtch
Party voted for in last national election, Switzerland
Which party did you vote for in that election? (Switzerland)
Value 	Category
1 	Radicals
2 	Christian Democratic Party
3 	Social Democratic Party / Socialist Party
4 	Swiss People's Party
5 	Liberal Party
6 	Alliance of the Independents
7 	Evangelical People's Party
8 	Christian Social Party
9 	Swiss Labour Party
10 	Green Party
11 	Swiss Democrats
12 	Federal Democratic Union
13 	Freiheits-Partei
14 	Political women's group
15 	Ticino League
16 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtcz
Party voted for in last national election, Czechia
Which party did you vote for in that election? (Czechia)
Value 	Category
1 	ČSSD
2 	ODA Civic Democratic Alliance
3 	Naděje (Hope)
4 	RMS Republicans of Miroslav Sladek
5 	ČSNS
6 	SV-SOS P.of Countryside-Assoc.Civic Forces
7 	Association of Independents
8 	ODS
9 	KSČM
10 	Koalice (Christian Dem.&Freedom Union)
11 	SŽJ P.for Life Securities
12 	PB Right Block
13 	SZ
14 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvde1
Party voted for in last national election 1, Germany
Which party did you vote for in that election? (Germany 1)
Value 	Category
1 	Social Democratic Party (SPD)
2 	Christian Democratic Union/Christian Social Union (CDU/CSU)
3 	Alliance 90/The Greens (Bündnis 90/Die Grünen)
4 	Free Democratic Party (FDP)
5 	Party of Democratic Socialism (PDS)
6 	The Republicans (REP)
7 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvde2
Party voted for in last national election 2, Germany
Which party did you vote for in that election? (Germany 2)
Value 	Category
1 	Social Democratic Party (SPD)
2 	Christian Democratic Union/Christian Social Union (CDU/CSU)
3 	Alliance 90/The Greens (Bündnis 90/Die Grünen)
4 	Free Democratic Party (FDP)
5 	Party of Democratic Socialism (PDS)
6 	The Republicans (REP)
7 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtdk
Party voted for in last national election, Denmark
Which party did you vote for in that election? (Denmark)
Value 	Category
1 	Socialdemokratiet
2 	Det Radikale Venstre
3 	Det Konservative Folkeparti
4 	Centrum-Demokraterne
5 	Socialistisk Folkeparti
6 	Dansk Folkeparti
7 	Kristeligt Folkeparti
8 	Venstre
9 	Fremskridtspartiet
10 	Enhedslisten
11 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtes
Party voted for in last national election, Spain
Which party did you vote for in that election? (Spain)
Value 	Category
1 	Partido Popular (PP)
2 	Partido Socialista Obrero Español (PSOE)
3 	Izquierda Unida (IU)
4 	Convergència i Unió (CiU)
5 	Esquerra Repubicana de Catalunya (ERC)
6 	Iniciativa per Catalunya-Verds (ICV)
7 	Partido Nacionalista Vasco (PNV)
8 	Eusko Alkartasuna (EA)
9 	Bloque Nacionalista Galego (BNG)
10 	Coalición Canaria (CC)
11 	Partido Andalucista (PA)
12 	Chunta Aragonesista (CHA)
68 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtfi
Party voted for in last national election, Finland
Which party did you vote for in that election? (Finland)
Value 	Category
1 	The National Coalition Party
2 	The Swedish People's Party (SPP)
3 	Liberals, (The liberal party of Finland)
4 	The Centre Party
5 	True Finns
6 	Christian Democrats
7 	League for Free Finland
8 	Green League
9 	Social Democratic Party
10 	Left Alliance
11 	Communist Party
12 	The Communist Workers' Party
13 	Natural law party
14 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtfr
Party voted for in last national election, France (ballot 1)
Which party did you vote for in that election? (France)
Value 	Category
1 	CPNT (Chasse, Pêche, Nature et Traditions)
2 	DL (Démocratie Libérale)
3 	FN (Front National)
4 	LCR (ligue communiste révolutionnaire)
5 	LO (Lutte ouvrière)
6 	MDC (Mouvement des citoyens)
7 	MNR (Mouvement National Républicain)
8 	MPF (Mouvement pour la France)
9 	PC (Parti communiste)
10 	PS (Parti Socialiste)
11 	RPF (Rassemblement du Peuple Français)
12 	UMP (Union de la Majorité Présidentielle)
13 	UDF (Union pour la Démocratie Française)
14 	Les Verts
15 	Autres mouvements écologistes
16 	Autre
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtgb
Party voted for in last national election, United Kingdom
Which party did you vote for in that election? (United Kingdom)
Value 	Category
1 	Conservative
2 	Labour
3 	Liberal Democrat
4 	Scottish National Party
5 	Plaid Cymru
6 	Green Party
7 	Other
11 	Ulster Unionist Party (nir)
12 	Democratic Unionist Party (nir)
13 	Sinn Féin (nir)
14 	Social Democratic and Labour Party (nir)
15 	Alliance Party (nir)
16 	Progressive Unionist Party (nir)
17 	United Kingdom Unionist Party (nir)
18 	Women's Coalition (nir)
19 	United Unionist Assembly Party (nir)
20 	Northern Ireland Unionist Party (nir)
21 	Workers' Party (nir)
22 	Other (nir)
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtgr
Party voted for in last national election, Greece
Which party did you vote for in that election? (Greece)
Value 	Category
1 	PASOK (Panhellenic Socialist Movement)
2 	ND (New Democracy)
3 	KKE (Communist party)
4 	SYN (Left Wing Coalition)
5 	DIKKI (Democratic Social Movement)
6 	Other parties
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvthu
Party voted for in last national election, Hungary
Which party did you vote for in that election? (Hungary)
Value 	Category
1 	Center Party
2 	FYD-HDF Fed.of Young Democrats&Hungarian Dem.Forum
3 	ISHP-Independent Small Holders
4 	HTJP-Hungarian Truth
5 	HSP-Hungarian Socialist Party
6 	WP-Workers Party
7 	FFD-Free Democrats
8 	None of them
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtie
Party voted for in last national election, Ireland
Which party did you vote for in that election? (Ireland)
Value 	Category
1 	Fianna Fáil
2 	Fine Gael
3 	Labour
4 	Progressive Democrats
5 	Green Party
6 	Sinn Féin
7 	Independent
8 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtil
Party voted for in last national election, Israel
Which party did you vote for in that election? (Israel)
Value 	Category
1 	Israel ahat
2 	Likud
3 	Shase
4 	Meretz
5 	Mafdal
6 	Yahadut-hatora, Agudat-Isarel, Degel-hatora
7 	Am ehad
8 	Shinuy
9 	Haehud haleumi
10 	The center party
11 	Israel baliya
12 	Israel byteno
14 	Hadereh hashlishit
15 	Pnina Rozenblum
16 	Tzomet
17 	Gimlaim
31 	Hadash
32 	Balad
33 	Hatnua Harabit Hameauhedet
34 	Haravi Hahadash
35 	Other
36 	White Ballot
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtit
Party voted for in last national election, Italy
Which party did you vote for in that election? (Italy)
Value 	Category
1 	Democratici di Sinistra
2 	La Margherita
3 	Comunisti Italiani
4 	Verdi e Sdi (Girasole)
6 	SVP Südtirol Vokspartei
7 	Rifondazione Comunista
8 	Forza Italia
9 	Alleanza Nazionale
10 	CCD-CDU (Biancofiore)
11 	Lega Nord
12 	Nuovo PSI
13 	Lista Di Pietro
14 	Democrazia Europea
15 	Pannella-Bonino
16 	Fiamma Tricolore
17 	Altro
70 	Ha votato solo al maggioritario
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtlu
Party voted for in last national election, Luxembourg
Which party did you vote for in that election? (Luxembourg)
Value 	Category
1 	Parti Chrétien Social (PCS)
2 	Parti Socialiste Ouvrier Luxembourgeois (PSOL)
3 	Parti Démocrate (PD)
4 	Les Verts
5 	La Gauche
6 	Comité d'action pour la Démocratie et la Justice sociale
7 	Autres
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtnl
Party voted for in last national election, Netherlands
Which party did you vote for in that election? (Netherlands)
Value 	Category
1 	Christian Democratic Appeal
2 	Labour Party
3 	People's Party for Freedom and Democracy
4 	List Pim Fortuyn
5 	Democrats '66
6 	Green Left
7 	Socialist Party
8 	Christian Union
9 	Liveable Netherlands
10 	Reformed Political Party
11 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtno
Party voted for in last national election, Norway
Which party did you vote for in that election? (Norway)
Value 	Category
1 	Rød Valgallianse
2 	Sosialistisk Venstreparti
3 	Det norske Arbeiderparti
4 	Venstre
5 	Kristelig Folkeparti
6 	Senterpartiet
7 	Høyre
8 	Fremskrittspartiet
9 	Kystpartiet
10 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtpl
Party voted for in last national election, Poland
Which party did you vote for in that election? (Poland)
Value 	Category
1 	Sojusz Lewicy Demokratycznej/Unia Pracy
2 	Akcja Wyborcza Solidarność Prawicy
3 	Unia Wolności
4 	Samoobrona Rzeczypospolitej Polskiej
5 	Prawo i Sprawiedliwość
6 	Polskie Stronnictwo Ludowe
7 	Platforma Obywatelska
8 	Alternatywa Ruch Społeczny
9 	Polska Wspólnota Narodowa
10 	Liga Polskich Rodzin
11 	Mniejszość Niemiecka
12 	Polska Unia Gospodarcza
13 	Polska Partia Socjalistyczna
14 	Niemiecka Mniejszość Górnego Śląska
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtpt
Party voted for in last national election, Portugal
Which party did you vote for in that election? (Portugal)
Value 	Category
1 	B.E. - Bloco de Esquerda
2 	CDS/PP - Centro Democrático Social / Partido Popular
3 	MPT - Movimento Partido da Terra
4 	P.H. - Partido Humanista
5 	PCP/PEV - Partido Comunista Português Partido Ecolo
6 	PCTP/MRPP - Partido Comunista dos Trabalhadores Po
7 	PNR - Partido Nacional Renovador
8 	POUS - Partido Operário de Unidade Socialista
9 	PPM - Partido Popular Monárquico
10 	PS - Partido Socialista
11 	PSD - Partido Social Democrata
12 	Other
13 	Blank vote
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtse
Party voted for in last national election, Sweden
Which party did you vote for in that election? (Sweden)
Value 	Category
1 	Centre Party
2 	Liberals
3 	Christian Democrats
4 	Green Party
5 	Conservative
6 	Social Democrats
7 	Left
8 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtvtsi
Party voted for in last national election, Slovenia
Which party did you vote for in that election? (Slovenia)
Value 	Category
1 	DESUS - Demokraticna stranka upokojencev Slovenije
2 	LDS - Liberalna demokracija Slovenije
3 	SLS - Slovenska ljudska stranka
4 	SNS - Slovenska nacionalna stranka
5 	SDS - Socialdemokratska Stranka Slovenije
6 	NSI - Nova Slovenija – Kršcanski demokrati
7 	ZLSD - Združena lista socialnih demokratov
8 	SMS - Stranka Mladih Slovenije
9 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
contplt
Contacted politician or government official last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Firstly ...Contacted a politician, government or local government official
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
wrkprty
Worked in political party or action group last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Have you... ...worked in a political party or action group?
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
wrkorg
Worked in another organisation or association last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Have you... ...worked in another organisation or association?
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
badge
Worn or displayed campaign badge/sticker last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Have you... ...worn or displayed a campaign badge/sticker?
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
sgnptit
Signed petition last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Have you... ...signed a petition?
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
pbldmn
Taken part in lawful public demonstration last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Have you... ...taken part in a lawful public demonstration?
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
bctprd
Boycotted certain products last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Have you... ...boycotted certain products?
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
bghtprd
Bought product for political/ethical/environment reason last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Firstly ...Deliberately bought certain products for political, ethical or environmental reasons
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dntmny
Donated money to political organisation or group last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Firstly ...Donated money to a political organisation or group
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ilglpst
Participated illegal protest activities last 12 months
ASK ALL
There are different ways of trying to improve things in [country] or help prevent things from going wrong. During the last 12 months, have you done any of the following? Firstly ...Participated in illegal protest activities
READ OUT
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
clsprty
Feel closer to a particular party than all other parties
ASK ALL
Is there a particular political party you feel closer to than all the other parties?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
prtclat
Which party feel closer to, Austria
Which one? (Austria)
Value 	Category
1 	SPÖ
2 	ÖVP
3 	FPÖ
4 	Grüne
5 	LIF
6 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclbe
Which party feel closer to, Belgium
Which one? (Belgium)
Value 	Category
1 	Agalev
2 	CD&V
3 	SP.A
4 	N-VA
5 	VLD
6 	Spirit
7 	PVDA
8 	Vlaams Blok
9 	VIVANT
10 	NCD
11 	ECOLO
12 	CDH (PSC)
13 	PS
14 	Mouvement Réformateur (MR)
15 	FRONT NATIONAL
16 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclch
Which party feel closer to, Switzerland
Which one? (Switzerland)
Value 	Category
1 	Radicals
2 	Christian Democratic Party
3 	Social Democratic Party / Socialist Party
4 	Swiss People's Party
5 	Liberal Party
6 	Alliance of the Independents
7 	Evangelical People's Party
8 	Christian Social Party
9 	Swiss Labour Party
10 	Green Party
11 	Swiss Democrats
12 	Federal Democratic Union
13 	Freiheits-Partei
14 	Political women's group
15 	Ticino League
16 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclcz
Which party feel closer to, Czechia
Which one? (Czechia)
Value 	Category
1 	ČSSD
2 	ODA Civic Democratic Alliance
3 	Naděje (Hope)
4 	RMS Republicans of Miroslav Sladek
5 	ČSNS
6 	SV-SOS P.of Countryside-Assoc.Civic Forces
7 	Association of Independents
8 	ODS
9 	KSČM
10 	KDU-CSL Christian Democratic P.
11 	US Freedom Union
12 	SŽJ P.for Life Securities
13 	PB Right Block
14 	SZ
15 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclde
Which party feel closer to, Germany
Which one? (Germany)
Value 	Category
1 	Social Democratic Party (SPD)
2 	Christian Democratic Union/Christian Social Union (CDU/CSU)
3 	Alliance 90/The Greens (Bündnis 90/Die Grünen)
4 	Free Democratic Party (FDP)
5 	Party of Democratic Socialism (PDS)
6 	The Republicans (REP)
7 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtcldk
Which party feel closer to, Denmark
Which one? (Denmark)
Value 	Category
1 	Socialdemokratiet
2 	Det Radikale Venstre
3 	Det Konservative Folkeparti
4 	Centrum-Demokraterne
5 	Socialistisk Folkeparti
6 	Dansk Folkeparti
7 	Kristeligt Folkeparti
8 	Venstre
9 	Fremskridtspartiet
10 	Enhedslisten
11 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtcles
Which party feel closer to, Spain
Which one? (Spain)
Value 	Category
1 	Partido Popular (PP)
2 	Partido Socialista Obrero Español (PSOE)
3 	Izquierda Unida (IU)
4 	Convergència i Unió (CiU)
5 	Esquerra Repubicana de Catalunya (ERC)
6 	Iniciativa per Catalunya-Verds (ICV)
7 	Partido Nacionalista Vasco (PNV)
8 	Eusko Alkartasuna (EA)
9 	Bloque Nacionalista Galego (BNG)
10 	Coalición Canaria (CC)
11 	Partido Andalucista (PA)
12 	Chunta Aragonesista (CHA)
68 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclfi
Which party feel closer to, Finland
Which one? (Finland)
Value 	Category
1 	The National Coalition Party
2 	The Swedish People's Party (SPP)
3 	Liberals, (The liberal party of Finland)
4 	The Centre Party
5 	True Finns
6 	Christian Democrats
7 	League for Free Finland
8 	Green League
9 	Social Democratic Party
10 	Left Alliance
11 	Communist Party
12 	The Communist Workers' Party
13 	Natural law party
14 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclfr
Which party feel closer to, France
Which one? (France)
Value 	Category
1 	CPNT (Chasse, Pêche, Nature et Traditions)
2 	DL (Démocratie Libérale)
3 	FN (Front National)
4 	LCR (ligue communiste révolutionnaire)
5 	LO (Lutte ouvrière)
6 	MDC (Mouvement des citoyens)
7 	MNR (Mouvement National Républicain)
8 	MPF (Mouvement pour la France)
9 	PC (Parti communiste)
10 	PS (Parti Socialiste)
11 	RPF (Rassemblement du Peuple Français)
12 	UMP (Union de la Majorité Présidentielle)
13 	UDF (Union pour la Démocratie Française)
14 	Les Verts
15 	Autres mouvements écologistes
16 	Autre
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclgb
Which party feel closer to, United Kingdom
Which one? (United Kingdom)
Value 	Category
1 	Conservative
2 	Labour
3 	Liberal Democrat
4 	Scottish National Party
5 	Plaid Cymru
6 	Green Party
7 	Other
11 	Ulster Unionist Party (nir)
12 	Democratic Unionist Party (nir)
13 	Sinn Féin (nir)
14 	Social Democratic and Labour Party (nir)
15 	Alliance Party (nir)
16 	Progressive Unionist Party (nir)
17 	United Kingdom Unionist Party (nir)
18 	Women's Coalition (nir)
19 	United Unionist Assembly Party (nir)
20 	Northern Ireland Unionist Party (nir)
21 	Workers' Party (nir)
22 	Other (nir)
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclgr
Which party feel closer to, Greece
Which one? (Greece)
Value 	Category
1 	PASOK (Panhellenic Socialist Movement)
2 	ND (New Democracy)
3 	KKE (Communist party)
4 	SYN (Left Wing Coalition)
5 	DIKKI (Democratic Social Movement)
6 	Other parties
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclhu
Which party feel closer to, Hungary
Which one? (Hungary)
Value 	Category
1 	Center Party
2 	FYD-Federation of Young Democrats
3 	ISHP-Independent Small Holders
4 	HDF- Hungarian Democratic Forum
5 	HTJP-Hungarian Truth
6 	HSP-Hungarian Socialist Party
7 	WP-Workers Party
8 	FFD-Free Democrats
9 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclie
Which party feel closer to, Ireland
Which one? (Ireland)
Value 	Category
1 	Fianna Fáil
2 	Fine Gael
3 	Labour
4 	Progressive Democrats
5 	Green Party
6 	Sinn Féin
7 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclil
Which party feel closer to, Israel
Which one? (Israel)
Value 	Category
1 	Israel ahat
2 	Likud
3 	Shase
4 	Meretz
5 	Mafdal
6 	Yahadut-hatora, Agudat-Isarel, Degel-hatora
7 	Am ehad
8 	Shinuy
9 	Haehud haleumi
10 	The center party
11 	Israel baliya
12 	Israel byteno
14 	Hadereh hashlishit
15 	Pnina Rozenblum
16 	Tzomet
17 	Gimlaim
31 	Hadash
32 	Balad
33 	Hatnua Harabit Hameauhedet
34 	Haravi Hahadash
35 	Other
36 	White Ballot
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclit
Which party feel closer to, Italy
Which one? (Italy)
Value 	Category
1 	Democratici di Sinistra
2 	La Margherita
3 	Comunisti Italiani
4 	Verdi
5 	SDI
6 	SVP (Südtirol Volksp
7 	Rifondazione Comunis
8 	Forza Italia
9 	Alleanza Nazionale
10 	CCD-CDU
11 	Lega Nord
12 	Nuovo PSI
13 	Lista di Pietro
14 	Democrazia Europea
15 	Pannella-Bonino
16 	Fiamma Tricolore
17 	Altro (SPECIFICARE)
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtcllu
Which party feel closer to, Luxembourg
Which one? (Luxembourg)
Value 	Category
1 	Parti Chrétien Social (PCS)
2 	Parti Socialiste Ouvrier Luxembourgeois (PSOL)
3 	Parti Démocrate (PD)
4 	Les Verts
5 	La Gauche
6 	Comité d'action pour la Démocratie et la Justice sociale
7 	Autres
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclnl
Which party feel closer to, Netherlands
Which one? (Netherlands)
Value 	Category
1 	Christian Democratic Appeal
2 	Labour Party
3 	People's Party for Freedom and Democracy
4 	List Pim Fortuyn
5 	Democrats '66
6 	Green Left
7 	Socialist Party
8 	Christian Union
9 	Liveable Netherlands
10 	Reformed Political Party
11 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclno
Which party feel closer to, Norway
Which one? (Norway)
Value 	Category
1 	Rød Valgallianse
2 	Sosialistisk Venstreparti
3 	Det norske Arbeiderparti
4 	Venstre
5 	Kristelig Folkeparti
6 	Senterpartiet
7 	Høyre
8 	Fremskrittspartiet
9 	Kystpartiet
10 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclpl
Which party feel closer to, Poland
Which one? (Poland)
Value 	Category
1 	Alternatywa Partia Pracy
2 	Konfederacja
3 	Krajowa Partia Emerytow i Rencistow
4 	Liga Polskich Rodzin
5 	Partia Ludowo-Demokratyczna
6 	Platforma Obywatelska
7 	Polska Partia Socjalistyczna
8 	Polska Unia Gospodarcza
9 	Polska Wspólnota Narodowa
10 	Polskie Stronnictwo Ludowe
11 	Prawo i Sprawiedliwość
12 	Ruch Spoleczny
13 	Samoobrona Rzeczypospolitej Polskiej
14 	Sojusz Lewicy Demokratycznej
15 	Stronnictwo Demokratyczne
16 	Stronnictwo Konserwatywno-Ludowe-Ruch Nowej Polski
17 	Unia Polityki Realnej
18 	Unia Pracy
19 	Unia Wolnosci
20 	Zjednoczenie Chrzescijansko-Narodowe
21 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclpt
Which party feel closer to, Portugal
Which one? (Portugal)
Value 	Category
1 	B.E. - Bloco de Esquerda
2 	CDS/PP - Centro Democrático Social / Partido Popular
3 	MPT - Movimento Partido da Terra
4 	P.H. - Partido Humanista
5 	PCP/PEV - Partido Comunista Português Partido Ecolo
6 	PCTP/MRPP - Partido Comunista dos Trabalhadores Po
7 	PNR - Partido Nacional Renovador
8 	POUS - Partido Operário de Unidade Socialista
9 	PPM - Partido Popular Monárquico
10 	PS - Partido Socialista
11 	PSD - Partido Social Democrata
12 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclse
Which party feel closer to, Sweden
Which one? (Sweden)
Value 	Category
1 	Centre Party
2 	Liberals
3 	Christian Democrats
4 	Green Party
5 	Conservative
6 	Social Democrats
7 	Left
8 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtclsi
Which party feel closer to, Slovenia
Which one? (Slovenia)
Value 	Category
1 	DESUS - Demokraticna stranka upokojencev Slovenije
2 	LDS - Liberalna demokracija Slovenije
3 	SLS - Slovenska ljudska stranka
4 	SNS - Slovenska nacionalna stranka
5 	SDS - Socialdemokratska Stranka Slovenije
6 	NSI - Nova Slovenija – Kršcanski demokrati
7 	ZLSD - Združena lista socialnih demokratov
8 	SMS - Stranka Mladih Slovenije
9 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtdgcl
How close to party
How close do you feel to this party? Do you feel that you are ...
READ OUT
Value 	Category
1 	Very close
2 	Quite close
3 	Not close
4 	Not at all close
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
mmbprty
Member of political party
Are you a member of any political party?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
prtmbat
Member of which party, Austria
Which one? (Austria)
Value 	Category
1 	SPÖ
2 	ÖVP
3 	FPÖ
4 	Grüne
5 	LIF
6 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbbe
Member of which party, Belgium
Which one? (Belgium)
Value 	Category
1 	Agalev
2 	CD&V
3 	SP.A
4 	N-VA
5 	VLD
6 	Spirit
7 	PVDA
8 	Vlaams Blok
9 	VIVANT
10 	NCD
11 	ECOLO
12 	CDH (PSC)
13 	PS
14 	Mouvement Réformateur (MR)
15 	FRONT NATIONAL
16 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbch
Member of which party, Switzerland
Which one? (Switzerland)
Value 	Category
1 	Radicals
2 	Christian Democratic Party
3 	Social Democratic Party / Socialist Party
4 	Swiss People's Party
5 	Liberal Party
6 	Alliance of the Independents
7 	Evangelical People's Party
8 	Christian Social Party
9 	Swiss Labour Party
10 	Green Party
11 	Swiss Democrats
12 	Federal Democratic Union
13 	Freiheits-Partei
14 	Political women's group
15 	Ticino League
16 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbcz
Member of which party, Czechia
Which one? (Czechia)
Value 	Category
1 	ČSSD
2 	ODA Civic Democratic Alliance
3 	Naděje (Hope)
4 	RMS Republicans of Miroslav Sladek
5 	ČSNS
6 	SV-SOS P.of Countryside-Assoc.Civic Forces
7 	Association of Independents
8 	ODS
9 	KSČM
10 	KDU-CSL Christian Democratic P.
11 	US Freedom Union
12 	SŽJ P.for Life Securities
13 	PB Right Block
14 	SZ
15 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbde
Member of which party, Germany
Which one? (Germany)
Value 	Category
1 	Social Democratic Party (SPD)
2 	Christian Democratic Union/Christian Social Union (CDU/CSU)
3 	Alliance 90/The Greens (Bündnis 90/Die Grünen)
4 	Free Democratic Party (FDP)
5 	Party of Democratic Socialism (PDS)
6 	The Republicans (REP)
7 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbdk
Member of which party, Denmark
Which one? (Denmark)
Value 	Category
1 	Socialdemokratiet
2 	Det Radikale Venstre
3 	Det Konservative Folkeparti
4 	Centrum-Demokraterne
5 	Socialistisk Folkeparti
6 	Dansk Folkeparti
7 	Kristeligt Folkeparti
8 	Venstre
9 	Fremskridtspartiet
10 	Enhedslisten
11 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbes
Member of which party, Spain
Which one? (Spain)
Value 	Category
1 	Partido Popular (PP)
2 	Partido Socialista Obrero Español (PSOE)
3 	Izquierda Unida (IU)
4 	Convergència i Unió (CiU)
5 	Esquerra Repubicana de Catalunya (ERC)
6 	Iniciativa per Catalunya-Verds (ICV)
7 	Partido Nacionalista Vasco (PNV)
8 	Eusko Alkartasuna (EA)
9 	Bloque Nacionalista Galego (BNG)
10 	Coalición Canaria (CC)
11 	Partido Andalucista (PA)
12 	Chunta Aragonesista (CHA)
68 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbfi
Member of which party, Finland
Which one? (Finland)
Value 	Category
1 	The National Coalition Party
2 	The Swedish People's Party (SPP)
3 	Liberals, (The liberal party of Finland)
4 	The Centre Party
5 	True Finns
6 	Christian Democrats
7 	League for Free Finland
8 	Green League
9 	Social Democratic Party
10 	Left Alliance
11 	Communist Party
12 	The Communist Workers' Party
13 	Natural law party
14 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbfr
Member of which party, France
Which one? (France)
Value 	Category
1 	CPNT (Chasse, Pêche, Nature et Traditions)
2 	DL (Démocratie Libérale)
3 	FN (Front National)
4 	LCR (ligue communiste révolutionnaire)
5 	LO (Lutte ouvrière)
6 	MDC (Mouvement des citoyens)
7 	MNR (Mouvement National Républicain)
8 	MPF (Mouvement pour la France)
9 	PC (Parti communiste)
10 	PS (Parti Socialiste)
11 	RPF (Rassemblement du Peuple Français)
12 	UMP (Union de la Majorité Présidentielle)
13 	UDF (Union pour la Démocratie Française)
14 	Les Verts
15 	Autres mouvements écologistes
16 	Autre
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbgb
Member of which party, United Kingdom
Which one? (United Kingdom)
Value 	Category
1 	Conservative
2 	Labour
3 	Liberal Democrat
4 	Scottish National Party
5 	Plaid Cymru
6 	Green Party
7 	Other
11 	Ulster Unionist Party (nir)
12 	Democratic Unionist Party (nir)
13 	Sinn Féin (nir)
14 	Social Democratic and Labour Party (nir)
15 	Alliance Party (nir)
16 	Progressive Unionist Party (nir)
17 	United Kingdom Unionist Party (nir)
18 	Women's Coalition (nir)
19 	United Unionist Assembly Party (nir)
20 	Northern Ireland Unionist Party (nir)
21 	Workers' Party (nir)
22 	Other (nir)
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbgr
Member of which party, Greece
Which one? (Greece)
Value 	Category
1 	PASOK (Panhellenic Socialist Movement)
2 	ND (New Democracy)
3 	KKE (Communist party)
4 	SYN (Left Wing Coalition)
5 	DIKKI (Democratic Social Movement)
6 	Other parties
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbhu
Member of which party, Hungary
Which one? (Hungary)
Value 	Category
1 	Center Party
2 	FYD-Federation of Young Democrats
3 	ISHP-Independent Small Holders
4 	HDF- Hungarian Democratic Forum
5 	HTJP-Hungarian Truth
6 	HSP-Hungarian Socialist Party
7 	WP-Workers Party
8 	FFD-Free Democrats
9 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbie
Member of which party, Ireland
Which one? (Ireland)
Value 	Category
1 	Fianna Fáil
2 	Fine Gael
3 	Labour
4 	Progressive Democrats
5 	Green Party
6 	Sinn Féin
7 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbil
Member of which party, Israel
Which one? (Israel)
Value 	Category
1 	Israel ahat
2 	Likud
3 	Shase
4 	Meretz
5 	Mafdal
6 	Yahadut-hatora, Agudat-Isarel, Degel-hatora
7 	Am ehad
8 	Shinuy
9 	Haehud haleumi
10 	The center party
11 	Israel baliya
12 	Israel byteno
14 	Hadereh hashlishit
15 	Pnina Rozenblum
16 	Tzomet
17 	Gimlaim
31 	Hadash
32 	Balad
33 	Hatnua Harabit Hameauhedet
34 	Haravi Hahadash
35 	Other
36 	White Ballot
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbit
Member of which party, Italy
Which one? (Italy)
Value 	Category
1 	Democratici di Sinistra
2 	La Margherita
3 	Comunisti Italiani
4 	Verdi
5 	SDI
6 	SVP (Südtirol Volkspartei)
7 	Rifondazione Comunis
8 	Forza Italia
9 	Alleanza Nazionale
10 	CCD-CDU
11 	Lega Nord
12 	Nuovo PSI
13 	Lista di Pietro
14 	Democrazia Europea
15 	Pannella-Bonino
16 	Fiamma Tricolore
17 	Altro (SPECIFICARE)
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmblu
Member of which party, Luxembourg
Which one? (Luxembourg)
Value 	Category
1 	Parti Chrétien Social (PCS)
2 	Parti Socialiste Ouvrier Luxembourgeois (PSOL)
3 	Parti Démocrate (PD)
4 	Les Verts
5 	La Gauche
6 	Comité d'action pour la Démocratie et la Justice sociale
7 	Autres
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbnl
Member of which party, Netherlands
Which one? (Netherlands)
Value 	Category
1 	Christian Democratic Appeal
2 	Labour Party
3 	People's Party for Freedom and Democracy
4 	List Pim Fortuyn
5 	Democrats '66
6 	Green Left
7 	Socialist Party
8 	Christian Union
9 	Liveable Netherlands
10 	Reformed Political Party
11 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbno
Member of which party, Norway
Which one? (Norway)
Value 	Category
1 	Rød Valgallianse
2 	Sosialistisk Venstreparti
3 	Det norske Arbeiderparti
4 	Venstre
5 	Kristelig Folkeparti
6 	Senterpartiet
7 	Høyre
8 	Fremskrittspartiet
9 	Kystpartiet
10 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbpl
Member of which party, Poland
Which one? (Poland)
Value 	Category
1 	Alternatywa Partia Pracy
2 	Konfederacja
3 	Krajowa Partia Emerytow i Rencistow
4 	Liga Polskich Rodzin
5 	Partia Ludowo-Demokratyczna
6 	Platforma Obywatelska
7 	Polska Partia Socjalistyczna
8 	Polska Unia Gospodarcza
9 	Polska Wspólnota Narodowa
10 	Polskie Stronnictwo Ludowe
11 	Prawo i Sprawiedliwość
12 	Ruch Spoleczny
13 	Samoobrona Rzeczypospolitej Polskiej
14 	Sojusz Lewicy Demokratycznej
15 	Stronnictwo Demokratyczne
16 	Stronnictwo Konserwatywno-Ludowe-Ruch Nowej Polski
17 	Unia Polityki Realnej
18 	Unia Pracy
19 	Unia Wolnosci
20 	Zjednoczenie Chrzescijansko-Narodowe
21 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbpt
Member of which party, Portugal
Which one? (Portugal)
Value 	Category
1 	B.E. - Bloco de Esquerda
2 	CDS/PP - Centro Democrático Social / Partido Popular
3 	MPT - Movimento Partido da Terra
4 	P.H. - Partido Humanista
5 	PCP/PEV - Partido Comunista Português Partido Ecolo
6 	PCTP/MRPP - Partido Comunista dos Trabalhadores Po
7 	PNR - Partido Nacional Renovador
8 	POUS - Partido Operário de Unidade Socialista
9 	PPM - Partido Popular Monárquico
10 	PS - Partido Socialista
11 	PSD - Partido Social Democrata
12 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbse
Member of which party, Sweden
Which one? (Sweden)
Value 	Category
1 	Centre Party
2 	Liberals
3 	Christian Democrats
4 	Green Party
5 	Conservative
6 	Social Democrats
7 	Left
8 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
prtmbsi
Member of which party, Slovenia
Which one? (Slovenia)
Value 	Category
1 	DESUS - Demokraticna stranka upokojencev Slovenije
2 	LDS - Liberalna demokracija Slovenije
3 	SLS - Slovenska ljudska stranka
4 	SNS - Slovenska nacionalna stranka
5 	SDS - Socialdemokratska Stranka Slovenije
6 	NSI - Nova Slovenija – Kršcanski demokrati
7 	ZLSD - Združena lista socialnih demokratov
8 	SMS - Stranka Mladih Slovenije
9 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
lrscale
Placement on left right scale
ASK ALL. CARD 12
In politics people sometimes talk of 'left' and 'right'. Using this card, where would you place yourself on this scale, where 0 means the left and 10 means the right?
Value 	Category
0 	Left
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Right
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
stflife
How satisfied with life as a whole
CARD 13
All things considered, how satisfied are you with your life as a whole nowadays? Please answer using this card, where 0 means extremely dissatisfied and 10 means extremely satisfied.
Value 	Category
0 	Extremely dissatisfied
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely satisfied
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
stfeco
How satisfied with present state of economy in country
STILL CARD 13
On the whole how satisfied are you with the present state of the economy in [country]?
Still use this card
Value 	Category
0 	Extremely dissatisfied
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely satisfied
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
stfgov
How satisfied with the national government
STILL CARD 13
Now thinking about the [country] government, how satisfied are you with the way it is doing its job?
Still use this card
Value 	Category
0 	Extremely dissatisfied
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely satisfied
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
stfdem
How satisfied with the way democracy works in country
STILL CARD 13
And on the whole, how satisfied are you with the way democracy works in [country]?
Still use this card
Value 	Category
0 	Extremely dissatisfied
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely satisfied
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
stfedu
State of education in country nowadays
CARD 14
Now, using this card, please say what you think overall about the state of education in [country] nowadays?
Value 	Category
0 	Extremely bad
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely good
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
stfhlth
State of health services in country nowadays
STILL CARD 14
Still using this card, please say what you think overall about the state of health services in [country] nowadays?
Value 	Category
0 	Extremely bad
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely good
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
dclenv
Preferred decision level of environmental protection policies
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...protecting the environment
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dclcrm
Preferred decision level of fighting against organised crime policies
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...fighting against organised crime
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dclagr
Preferred decision level of agricultural policies
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...agriculture
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dcldef
Preferred decision level of defence policies
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...defence
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dclwlfr
Preferred decision level of social welfare policies
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...social welfare
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dclaid
Preferred decision level of policies about aid to developing countries
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...aid to developing countries
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dclmig
Preferred decision level of immigration and refugees policies
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...immigration and refugees
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dclintr
Preferred decision level of interest rates policies
CARD 15
Policies can be decided at different levels. Using this card, at which level do you think the following policies should mainly be decided? ...interest rates
READ OUT AND CODE ONE ON EACH LINE
Value 	Category
1 	International level
2 	European level
3 	National level
4 	Regional or local level
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ginveco
The less government intervenes in economy, the better for country
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements The less that government intervenes in the economy, the better it is for [country]
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
gincdif
Government should reduce differences in income levels
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements. The government should take measures to reduce differences in income levels
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
needtru
Employees need strong trade unions to protect work conditions/wages
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements Employees need strong trade unions to protect their working conditions and wages
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
freehms
Gays and lesbians free to live life as they wish
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements. Gay men and lesbians should be free to live their own life as they wish
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
lawobey
The law should always be obeyed
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements Whatever the circumstances, the law should always be obeyed
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
prtyban
Ban political parties that wish overthrow democracy
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements Political parties that wish to overthrow democracy should be banned
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ecohenv
Economic growth always ends up harming environment
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements Economic growth always ends up harming the environment
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
scnsenv
Modern science can be relied on to solve environmental problems
CARD 16
Using this card, please say to what extent you agree or disagree with each of the following statements Modern science can be relied on to solve our environmental problems
READ OUT EACH STATEMENT AND CODE IN GRID
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
happy
How happy are you
CARD 17
Taking all things together, how happy would you say you are?
Please use this card
Value 	Category
0 	Extremely unhappy
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely happy
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
sclmeet
How often socially meet with friends, relatives or colleagues
CARD 18
Using this card, how often do you meet socially with friends, relatives or work colleagues?
Value 	Category
1 	Never
2 	Less than once a month
3 	Once a month
4 	Several times a month
5 	Once a week
6 	Several times a week
7 	Every day
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
inmdisc
Anyone to discuss intimate and personal matters with
Do you have anyone with whom you can discuss intimate and personal matters?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
sclact
Take part in social activities compared to others of same age
CARD 19
Compared to other people of your age, how often would you say you take part in social activities?
Please use this card
Value 	Category
1 	Much less than most
2 	Less than most
3 	About the same
4 	More than most
5 	Much more than most
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
crmvct
Respondent or household member victim of burglary/assault last 5 years
Have you or a member of your household been the victim of a burglary or assault in the last 5 years?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
aesfdrk
Feeling of safety of walking alone in local area after dark
How safe do you - or would you - feel walking alone in this area after dark? Do - or would - you feel...
READ OUT
Value 	Category
1 	Very safe
2 	Safe
3 	Unsafe
4 	Very unsafe
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
health
Subjective general health
How is your health in general? Would you say it is ...
READ OUT
Value 	Category
1 	Very good
2 	Good
3 	Fair
4 	Bad
5 	Very bad
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
hlthhmp
Hampered in daily activities by illness/disability/infirmity/mental problem
Are you hampered in your daily activities in any way by any longstanding illness, or disability, infirmity or mental health problem?
PROMPT IN RELATION TO PRECODES
Value 	Category
1 	Yes a lot
2 	Yes to some extent
3 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rlgblg
Belonging to particular religion or denomination
Do you consider yourself as belonging to any particular religion or denomination?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rlgdnm
Religion or denomination belonging to at present
Which one?
Value 	Category
1 	Roman Catholic
2 	Protestant
3 	Eastern Orthodox
4 	Other Christian denomination
5 	Jewish
6 	Islam
7 	Eastern religions
8 	Other Non-Christian religions
66 	Not applicable*
77 	Refusal*
99 	No answer*

*) Missing Value
rlgblge
Ever belonging to particular religion or denomination
Have you ever considered yourself as belonging to any particular religion or denomination?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rlgdnme
Religion or denomination belonging to in the past
Which one?
Value 	Category
1 	Roman Catholic
2 	Protestant
3 	Eastern Orthodox
4 	Other Christian denomination
5 	Jewish
6 	Islam
7 	Eastern religions
8 	Other Non-Christian religions
66 	Not applicable*
77 	Refusal*
99 	No answer*

*) Missing Value
rlgdgr
How religious are you
ASK ALL. CARD 20
Regardless of whether you belong to a particular religion, how religious would you say you are?
Please use this card
Value 	Category
0 	Not at all religious
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Very religious
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
rlgatnd
How often attend religious services apart from special occasions
CARD 21
Apart from special occasions such as weddings and funerals, about how often do you attend religious services nowadays?
Value 	Category
1 	Every day
2 	More than once a week
3 	Once a week
4 	At least once a month
5 	Only on special holy days
6 	Less often
7 	Never
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
pray
How often pray apart from at religious services
CARD 21 AGAIN
Apart from when you are at religious services, how often, if at all, do you pray?
Please use this card
Value 	Category
1 	Every day
2 	More than once a week
3 	Once a week
4 	At least once a month
5 	Only on special holy days
6 	Less often
7 	Never
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
dscrgrp
Member of a group discriminated against in this country
ASK ALL
Would you describe yourself as being a member of a group that is discriminated against in this country?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dscrrce
Discrimination of respondent's group: colour or race
On what grounds is your group discriminated against? Colour or race
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrntn
Discrimination of respondent's group: nationality
On what grounds is your group discriminated against? Nationality
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrrlg
Discrimination of respondent's group: religion
On what grounds is your group discriminated against? Religion
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrlng
Discrimination of respondent's group: language
On what grounds is your group discriminated against? Language
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscretn
Discrimination of respondent's group: ethnic group
On what grounds is your group discriminated against? Ethnic group
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrage
Discrimination of respondent's group: age
On what grounds is your group discriminated against? Age
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrgnd
Discrimination of respondent's group: gender
On what grounds is your group discriminated against? Gender
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrsex
Discrimination of respondent's group: sexuality
On what grounds is your group discriminated against? Sexuality
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrdsb
Discrimination of respondent's group: disability
On what grounds is your group discriminated against? Disability
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscroth
Discrimination of respondent's group: other grounds
On what grounds is your group discriminated against? Other
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrdk
Discrimination of respondent's group: don't know
On what grounds is your group discriminated against? Don't know
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrref
Discrimination of respondent's group: refusal
On what grounds is your group discriminated against? Refusal
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrnap
Discrimination of respondent's group: not applicable
On what grounds is your group discriminated against? Not applicable
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dscrna
Discrimination of respondent's group: no answer
On what grounds is your group discriminated against? No answer
PROBE: 'What other grounds?' CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
ctzcntr
Citizen of country
ASK ALL
Are you a citizen of [country]?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ctzship
Citizenship
What citizenship do you hold?
WRITE IN
Value 	Category
AD 	Andorra
AE 	United Arab Emirates
AF 	Afghanistan
AG 	Antigua and Barbuda
AI 	Anguilla
AL 	Albania
AM 	Armenia
AN 	Netherlands Antilles
AO 	Angola
AQ 	Antarctica
AR 	Argentina
AS 	American Samoa
AT 	Austria
AU 	Australia
AW 	Aruba
AZ 	Azerbaijan
BA 	Bosnia and Herzegovina
BB 	Barbados
BD 	Bangladesh
BE 	Belgium
BF 	Burkina Faso
BG 	Bulgaria
BH 	Bahrain
BI 	Burundi
BJ 	Benin
BM 	Bermuda
BN 	Brunei Darussalam
BO 	Bolivia
BR 	Brazil
BS 	Bahamas
BT 	Bhutan
BV 	Bouvet Island
BW 	Botswana
BY 	Belarus
BZ 	Belize
CA 	Canada
CC 	Cocos (Keeling) Islands
CD 	Congo, The Democratic Republic of the
CF 	Central African Republic
CG 	Congo
CH 	Switzerland
CI 	Côte d'Ivoire
CK 	Cook Islands
CL 	Chile
CM 	Cameroon
CN 	China
CO 	Colombia
CR 	Costa Rica
CS 	Czechoslovakia
CU 	Cuba
CV 	Cabo Verde
CX 	Christmas Island
CY 	Cyprus
CZ 	Czechia
DE 	Germany
DJ 	Djibouti
DK 	Denmark
DM 	Dominica
DO 	Dominican Republic
DZ 	Algeria
EC 	Ecuador
EE 	Estonia
EG 	Egypt
EH 	Western Sahara
ER 	Eritrea
ES 	Spain
ET 	Ethiopia
FI 	Finland
FJ 	Fiji
FK 	Falkland Islands (Malvinas)
FM 	Micronesia, Federated States of
FO 	Faroe Islands
FR 	France
GA 	Gabon
GB 	United Kingdom
GD 	Grenada
GE 	Georgia
GF 	French Guiana
GH 	Ghana
GI 	Gibraltar
GL 	Greenland
GM 	Gambia
GN 	Guinea
GP 	Guadeloupe
GQ 	Equatorial Guinea
GR 	Greece
GS 	South Georgia and the South Sandwich Islands
GT 	Guatemala
GU 	Guam
GW 	Guinea-Bissau
GY 	Guyana
HK 	Hong Kong
HM 	Heard Island and McDonald Islands
HN 	Honduras
HR 	Croatia
HT 	Haiti
HU 	Hungary
ID 	Indonesia
IE 	Ireland
IL 	Israel
IN 	India
IO 	British Indian Ocean Territory
IQ 	Iraq
IR 	Iran, Islamic Republic of
IS 	Iceland
IT 	Italy
JM 	Jamaica
JO 	Jordan
JP 	Japan
KE 	Kenya
KG 	Kyrgyzstan
KH 	Cambodia
KI 	Kiribati
KM 	Comoros
KN 	Saint Kitts and Nevis
KP 	Korea, Democratic People's Republic of
KR 	Korea, Republic of
KW 	Kuwait
KY 	Cayman Islands
KZ 	Kazakhstan
LA 	Lao People's Democratic Republic
LB 	Lebanon
LC 	Saint Lucia
LI 	Liechtenstein
LK 	Sri Lanka
LR 	Liberia
LS 	Lesotho
LT 	Lithuania
LU 	Luxembourg
LV 	Latvia
LY 	Libyan Arab Jamahiriya
MA 	Morocco
MC 	Monaco
MD 	Moldova, Republic of
MG 	Madagascar
MH 	Marshall Islands
MK 	Macedonia
ML 	Mali
MM 	Myanmar
MN 	Mongolia
MO 	Macao
MP 	Northern Mariana Islands
MQ 	Martinique
MR 	Mauritania
MS 	Montserrat
MT 	Malta
MU 	Mauritius
MV 	Maldives
MW 	Malawi
MX 	Mexico
MY 	Malaysia
MZ 	Mozambique
NA 	Namibia
NC 	New Caledonia
NE 	Niger
NF 	Norfolk Island
NG 	Nigeria
NI 	Nicaragua
NL 	Netherlands
NO 	Norway
NP 	Nepal
NR 	Nauru
NU 	Niue
NZ 	New Zealand
OM 	Oman
PA 	Panama
PE 	Peru
PF 	French Polynesia
PG 	Papua New Guinea
PH 	Philippines
PK 	Pakistan
PL 	Poland
PM 	Saint Pierre and Miquelon
PN 	Pitcairn
PR 	Puerto Rico
PS 	Palestinian Territory, Occupied
PT 	Portugal
PW 	Palau
PY 	Paraguay
QA 	Qatar
RE 	Réunion
RO 	Romania
RU 	Russian Federation
RW 	Rwanda
SA 	Saudi Arabia
SB 	Solomon Islands
SC 	Seychelles
SD 	Sudan
SE 	Sweden
SG 	Singapore
SH 	Saint Helena
SI 	Slovenia
SJ 	Svalbard and Jan Mayen
SK 	Slovakia
SL 	Sierra Leone
SM 	San Marino
SN 	Senegal
SO 	Somalia
SR 	Suriname
ST 	Sao Tome and Principe
SU 	USSR
SV 	El Salvador
SY 	Syrian Arab Republic
SZ 	Swaziland
TC 	Turks and Caicos Islands
TD 	Chad
TF 	French Southern Territories
TG 	Togo
TH 	Thailand
TJ 	Tajikistan
TK 	Tokelau
TM 	Turkmenistan
TN 	Tunisia
TO 	Tonga
TP 	East Timor
TR 	Turkey
TT 	Trinidad and Tobago
TV 	Tuvalu
TW 	Taiwan, Province of China
TZ 	Tanzania, United Republic of
UA 	Ukraine
UG 	Uganda
UM 	United States Minor Outlying Islands
US 	United States of America
UY 	Uruguay
UZ 	Uzbekistan
VA 	Holy See
VC 	Saint Vincent and the Grenadines
VE 	Venezuela
VG 	Virgin Islands, British
VI 	Virgin Islands, U.S.
VN 	Viet Nam
VU 	Vanuatu
WF 	Wallis and Futuna
WS 	Samoa
YE 	Yemen
YT 	Mayotte
YU 	Yugoslavia
ZA 	South Africa
ZM 	Zambia
ZW 	Zimbabwe
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
brncntr
Born in country
ASK ALL
Were you born in [country]?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
cntbrth
Country of birth
In which country were you born?
WRITE IN
Value 	Category
AD 	Andorra
AE 	United Arab Emirates
AF 	Afghanistan
AG 	Antigua and Barbuda
AI 	Anguilla
AL 	Albania
AM 	Armenia
AN 	Netherlands Antilles
AO 	Angola
AQ 	Antarctica
AR 	Argentina
AS 	American Samoa
AT 	Austria
AU 	Australia
AW 	Aruba
AZ 	Azerbaijan
BA 	Bosnia and Herzegovina
BB 	Barbados
BD 	Bangladesh
BE 	Belgium
BF 	Burkina Faso
BG 	Bulgaria
BH 	Bahrain
BI 	Burundi
BJ 	Benin
BM 	Bermuda
BN 	Brunei Darussalam
BO 	Bolivia
BR 	Brazil
BS 	Bahamas
BT 	Bhutan
BV 	Bouvet Island
BW 	Botswana
BY 	Belarus
BZ 	Belize
CA 	Canada
CC 	Cocos (Keeling) Islands
CD 	Congo, The Democratic Republic of the
CF 	Central African Republic
CG 	Congo
CH 	Switzerland
CI 	Côte d'Ivoire
CK 	Cook Islands
CL 	Chile
CM 	Cameroon
CN 	China
CO 	Colombia
CR 	Costa Rica
CS 	Czechoslovakia
CU 	Cuba
CV 	Cabo Verde
CX 	Christmas Island
CY 	Cyprus
CZ 	Czechia
DE 	Germany
DJ 	Djibouti
DK 	Denmark
DM 	Dominica
DO 	Dominican Republic
DZ 	Algeria
EC 	Ecuador
EE 	Estonia
EG 	Egypt
EH 	Western Sahara
ER 	Eritrea
ES 	Spain
ET 	Ethiopia
FI 	Finland
FJ 	Fiji
FK 	Falkland Islands (Malvinas)
FM 	Micronesia, Federated States of
FO 	Faroe Islands
FR 	France
GA 	Gabon
GB 	United Kingdom
GD 	Grenada
GE 	Georgia
GF 	French Guiana
GH 	Ghana
GI 	Gibraltar
GL 	Greenland
GM 	Gambia
GN 	Guinea
GP 	Guadeloupe
GQ 	Equatorial Guinea
GR 	Greece
GS 	South Georgia and the South Sandwich Islands
GT 	Guatemala
GU 	Guam
GW 	Guinea-Bissau
GY 	Guyana
HK 	Hong Kong
HM 	Heard Island and McDonald Islands
HN 	Honduras
HR 	Croatia
HT 	Haiti
HU 	Hungary
ID 	Indonesia
IE 	Ireland
IL 	Israel
IN 	India
IO 	British Indian Ocean Territory
IQ 	Iraq
IR 	Iran, Islamic Republic of
IS 	Iceland
IT 	Italy
JM 	Jamaica
JO 	Jordan
JP 	Japan
KE 	Kenya
KG 	Kyrgyzstan
KH 	Cambodia
KI 	Kiribati
KM 	Comoros
KN 	Saint Kitts and Nevis
KP 	Korea, Democratic People's Republic of
KR 	Korea, Republic of
KW 	Kuwait
KY 	Cayman Islands
KZ 	Kazakhstan
LA 	Lao People's Democratic Republic
LB 	Lebanon
LC 	Saint Lucia
LI 	Liechtenstein
LK 	Sri Lanka
LR 	Liberia
LS 	Lesotho
LT 	Lithuania
LU 	Luxembourg
LV 	Latvia
LY 	Libyan Arab Jamahiriya
MA 	Morocco
MC 	Monaco
MD 	Moldova, Republic of
MG 	Madagascar
MH 	Marshall Islands
MK 	Macedonia
ML 	Mali
MM 	Myanmar
MN 	Mongolia
MO 	Macao
MP 	Northern Mariana Islands
MQ 	Martinique
MR 	Mauritania
MS 	Montserrat
MT 	Malta
MU 	Mauritius
MV 	Maldives
MW 	Malawi
MX 	Mexico
MY 	Malaysia
MZ 	Mozambique
NA 	Namibia
NC 	New Caledonia
NE 	Niger
NF 	Norfolk Island
NG 	Nigeria
NI 	Nicaragua
NL 	Netherlands
NO 	Norway
NP 	Nepal
NR 	Nauru
NU 	Niue
NZ 	New Zealand
OM 	Oman
PA 	Panama
PE 	Peru
PF 	French Polynesia
PG 	Papua New Guinea
PH 	Philippines
PK 	Pakistan
PL 	Poland
PM 	Saint Pierre and Miquelon
PN 	Pitcairn
PR 	Puerto Rico
PS 	Palestinian Territory, Occupied
PT 	Portugal
PW 	Palau
PY 	Paraguay
QA 	Qatar
RE 	Réunion
RO 	Romania
RU 	Russian Federation
RW 	Rwanda
SA 	Saudi Arabia
SB 	Solomon Islands
SC 	Seychelles
SD 	Sudan
SE 	Sweden
SG 	Singapore
SH 	Saint Helena
SI 	Slovenia
SJ 	Svalbard and Jan Mayen
SK 	Slovakia
SL 	Sierra Leone
SM 	San Marino
SN 	Senegal
SO 	Somalia
SR 	Suriname
ST 	Sao Tome and Principe
SU 	USSR
SV 	El Salvador
SY 	Syrian Arab Republic
SZ 	Swaziland
TC 	Turks and Caicos Islands
TD 	Chad
TF 	French Southern Territories
TG 	Togo
TH 	Thailand
TJ 	Tajikistan
TK 	Tokelau
TM 	Turkmenistan
TN 	Tunisia
TO 	Tonga
TP 	East Timor
TR 	Turkey
TT 	Trinidad and Tobago
TV 	Tuvalu
TW 	Taiwan, Province of China
TZ 	Tanzania, United Republic of
UA 	Ukraine
UG 	Uganda
UM 	United States Minor Outlying Islands
US 	United States of America
UY 	Uruguay
UZ 	Uzbekistan
VA 	Holy See
VC 	Saint Vincent and the Grenadines
VE 	Venezuela
VG 	Virgin Islands, British
VI 	Virgin Islands, U.S.
VN 	Viet Nam
VU 	Vanuatu
WF 	Wallis and Futuna
WS 	Samoa
YE 	Yemen
YT 	Mayotte
YU 	Yugoslavia
ZA 	South Africa
ZM 	Zambia
ZW 	Zimbabwe
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
livecntr
How long ago first came to live in country
CARD 22
How long ago did you first come to live in [country]?
Please use this card
Value 	Category
1 	Within last year
2 	1-5 years ago
3 	6-10 years ago
4 	11-20 years ago
5 	More than 20 years ago
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
lnghoma
Language most often spoken at home: first mentioned
ASK ALL
What language or languages do you speak most often at home? Language 1
[to be coded into ISO693-2]. WRITE IN UP TO 2 LANGUAGES
Value 	Category
AAR 	Afar
ABK 	Abkhazian
ACE 	Achinese
ACH 	Acoli
ADA 	Adangme
AFA 	Afro-Asiatic (Other)
AFH 	Afrihili
AFR 	Afrikaans
AKA 	Akan
AKK 	Akkadian
ALB 	Albanian
ALE 	Aleut
ALG 	Algonquian languages
AMH 	Amharic
ANG 	English, Old (ca.450-1100)
APA 	Apache languages
ARA 	Arabic
ARC 	Aramaic
ARM 	Armenian
ARN 	Araucanian
ARP 	Arapaho
ART 	Artificial (Other)
ARW 	Arawak
ASM 	Assamese
AST 	Asturian, Bable
ATH 	Athapascan languages
AUS 	Australian languages
AVA 	Avaric
AVE 	Avestan
AWA 	Awadhi
AYM 	Aymara
AZE 	Azerbaijani
BAD 	Banda
BAI 	Bamileke languages
BAK 	Bashkir
BAL 	Baluchi
BAM 	Bambara
BAN 	Balinese
BAQ 	Basque
BAS 	Basa
BAT 	Baltic (Other)
BEJ 	Beja
BEL 	Belarusian
BEM 	Bemba
BEN 	Bengali
BER 	Berber (Other)
BHO 	Bhojpuri
BIH 	Bihari
BIK 	Bikol
BIN 	Bini
BIS 	Bislama
BLA 	Siksika
BNT 	Bantu (Other)
BOS 	Bosnian
BRA 	Braj
BRE 	Breton
BTK 	Batak (Indonesia)
BUA 	Buriat
BUG 	Buginese
BUL 	Bulgarian
BUR 	Burmese
CAD 	Caddo
CAI 	Central American Indian (Other)
CAR 	Carib
CAT 	Catalan
CAU 	Caucasian (Other)
CEB 	Cebuano
CEL 	Celtic (Other)
CHA 	Chamorro
CHB 	Chibcha
CHE 	Chechen
CHG 	Chagatai
CHI 	Chinese
CHK 	Chuukese
CHM 	Mari
CHN 	Chinook jargon
CHO 	Choctaw
CHP 	Chipewyan
CHR 	Cherokee
CHU 	Old/Church Slavic, Slavonic, Bulgarian
CHV 	Chuvash
CHY 	Cheyenne
CMC 	Chamic languages
COP 	Coptic
COR 	Cornish
COS 	Corsican
CPE 	Creoles and pidgins, English-based (Other)
CPF 	Creoles and pidgins, French-based (Other)
CPP 	Creoles and pidgins, Portuguese-based (Other)
CRE 	Cree
CRP 	Creoles and pidgins(Other)
CUS 	Cushitic (Other)
CZE 	Czech
DAK 	Dakota
DAN 	Danish
DAY 	Dayak
DEL 	Delaware
DEN 	Slave (Athapascan)
DGR 	Dogrib
DIN 	Dinka
DIV 	Divehi
DOI 	Dogri
DRA 	Dravidian (Other)
DUA 	Duala
DUM 	Dutch, Middle (ca. 1050-1350)
DUT 	Dutch
DYU 	Dyula
DZO 	Dzongkha
EFI 	Efik
EGY 	Egyptian (Ancient)
EKA 	Ekajuk
ELX 	Elamite
ENG 	English
ENM 	English, Middle (1100-1500)
EPO 	Esperanto
EST 	Estonian
EWE 	Ewe
EWO 	Ewondo
FAN 	Fang
FAO 	Faroese
FAT 	Fanti
FIJ 	Fijian
FIN 	Finnish
FIU 	Finno-Ugrian (Other)
FON 	Fon
FRE 	French
FRM 	French, Middle (ca.1400-1600)
FRO 	French, Old (842-ca.1400)
FRY 	Frisian
FUL 	Fulah
FUR 	Friulian
GAA 	Ga
GAY 	Gayo
GBA 	Gbaya
GEM 	Germanic (Other)
GEO 	Georgian
GER 	German
GEZ 	Geez
GIL 	Gilbertese
GLA 	Gaelic Scottish
GLE 	Irish
GLG 	Gallegan
GLV 	Manx
GMH 	German, Middle High (ca.1050-1500)
GOH 	German, Old High (ca.750-1050)
GON 	Gondi
GOR 	Gorontalo
GOT 	Gothic
GRB 	Grebo
GRC 	Greek, Ancient (to 1453)
GRE 	Greek, Modern (1453-)
GRN 	Guarani
GUJ 	Gujarati
GWI 	Gwich'in
HAI 	Haida
HAU 	Hausa
HAW 	Hawaiian
HEB 	Hebrew
HER 	Herero
HIL 	Hiligaynon
HIM 	Himachali
HIN 	Hindi
HIT 	Hittite
HMN 	Hmong
HMO 	Hiri Motu
HUN 	Hungarian
HUP 	Hupa
IBA 	Iban
IBO 	Igbo
ICE 	Icelandic
IDO 	Ido
IJO 	Ijo
IKU 	Inuktitut
ILE 	Interlingue
ILO 	Iloko
INA 	Interlingua (International Auxiliary Language Association)
INC 	Indic (Other)
IND 	Indonesian
INE 	Indo-European (Other)
IPK 	Inupiaq
IRA 	Iranian (Other)
IRO 	Iroquoian languages
ITA 	Italian
JAV 	Javanese
JPN 	Japanese
JPR 	Judeo-Persian
JRB 	Judeo-Arabic
KAA 	Kara-Kalpak
KAB 	Kabyle
KAC 	Kachin
KAL 	Kalaallisut
KAM 	Kamba
KAN 	Kannada
KAR 	Karen
KAS 	Kashmiri
KAU 	Kanuri
KAW 	Kawi
KAZ 	Kazakh
KHA 	Khasi
KHI 	Khoisan (Other)
KHM 	Khmer
KHO 	Khotanese
KIK 	Kikuyu
KIN 	Kinyarwanda
KIR 	Kirghiz
KMB 	Kimbundu
KOK 	Konkani
KOM 	Komi
KON 	Kongo
KOR 	Korean
KOS 	Kosraean
KPE 	Kpelle
KRO 	Kru
KRU 	Kurukh
KUA 	Kuanyama
KUM 	Kumyk
KUR 	Kurdish
KUT 	Kutenai
LAD 	Ladino
LAH 	Lahnda
LAM 	Lamba
LAO 	Lao
LAT 	Latin
LAV 	Latvian
LEZ 	Lezghian
LIN 	Lingala
LIT 	Lithuanian
LOL 	Mongo
LOZ 	Lozi
LTZ 	Luxembourgish, Letzeburgesch
LUA 	Luba-Lulua
LUB 	Luba-Katanga
LUG 	Ganda
LUI 	Luiseno
LUN 	Lunda
LUO 	Luo (Kenya and Tanzania)
LUS 	Lushai
MAC 	Macedonian
MAD 	Madurese
MAG 	Magahi
MAH 	Marshallese
MAI 	Maithili
MAK 	Makasar
MAL 	Malayalam
MAN 	Mandingo
MAO 	Maori
MAP 	Austronesian (Other)
MAR 	Marathi
MAS 	Masai
MAY 	Malay
MDR 	Mandar
MEN 	Mende
MGA 	Irish, Middle (900-1200)
MIC 	Micmac
MIN 	Minangkabau
MIS 	Miscellaneous languages
MKH 	Mon-Khmer (Other)
MLG 	Malagasy
MLT 	Maltese
MNC 	Manchu
MNI 	Manipuri
MNO 	Manobo languages
MOH 	Mohawk
MOL 	Moldavian
MON 	Mongolian
MOS 	Mossi
MUL 	Multiple languages
MUN 	Munda languages
MUS 	Creek
MWR 	Marwari
MYN 	Mayan languages
NAH 	Nahuatl
NAI 	North American Indian (Other)
NAU 	Nauru
NAV 	Navaho
NBL 	Ndebele, South
NDE 	Ndebele, North
NDO 	Ndonga
NDS 	Low German, Saxon
NEP 	Nepali
NEW 	Newari
NIA 	Nias
NIC 	Niger-Kordofanian (Other)
NIU 	Niuean
NNO 	Norwegian Nynorsk
NOB 	Norwegian Bokmål
NON 	Norse, Old
NOR 	Norwegian
NSO 	Sotho, Northern
NUB 	Nubian languages
NYA 	Chewa, Chichewa, Nyanja
NYM 	Nyamwezi
NYN 	Nyankole
NYO 	Nyoro
NZI 	Nzima
OCI 	Provençal, Occitan (post 1500)
OJI 	Ojibwa
ORI 	Oriya
ORM 	Oromo
OSA 	Osage
OSS 	Ossetian
OTA 	Turkish, Ottoman (1500-1928)
OTO 	Otomian languages
PAA 	Papuan (Other)
PAG 	Pangasinan
PAL 	Pahlavi
PAM 	Pampanga
PAN 	Panjabi
PAP 	Papiamento
PAU 	Palauan
PEO 	Persian, Old (ca.600-400)
PER 	Persian
PHI 	Philippine (Other)
PHN 	Phoenician
PLI 	Pali
POL 	Polish
PON 	Pohnpeian
POR 	Portuguese
PRA 	Prakrit languages
PRO 	Provençal, Old (to 1500)
PUS 	Pushto
QAA 	Local language, Italy
QTR 	Local languages, Turkey
QUE 	Quechua
RAJ 	Rajasthani
RAP 	Rapanui
RAR 	Rarotongan
ROA 	Romance (Other)
ROH 	Raeto-Romance
ROM 	Romany
RUM 	Romanian
RUN 	Rundi
RUS 	Russian
SAD 	Sandawe
SAG 	Sango
SAH 	Yakut
SAI 	South American Indian (Other)
SAL 	Salishan languages
SAM 	Samaritan Aramaic
SAN 	Sanskrit
SAS 	Sasak
SAT 	Santali
SCC 	Serbian
SCO 	Scots
SCR 	Croatian
SEL 	Selkup
SEM 	Semitic (Other)
SGA 	Irish, Old (to 900)
SGN 	Sign languages
SHN 	Shan
SID 	Sidamo
SIN 	Sinhalese
SIO 	Siouan languages
SIT 	Sino-Tibetan (Other)
SLA 	Slavic (Other)
SLO 	Slovak
SLV 	Slovenian
SMA 	Southern Sami
SME 	Northern Sami
SMI 	Sami languages (Other)
SMJ 	Lule Sami
SMN 	Inari Sami
SMO 	Samoan
SMS 	Skolt Sami
SNA 	Shona
SND 	Sindhi
SNK 	Soninke
SOG 	Sogdian
SOM 	Somali
SON 	Songhai
SOT 	Sotho, Southern
SPA 	Spanish, Castilian
SRD 	Sardinian
SRR 	Serer
SSA 	Nilo-Saharan (Other)
SSW 	Swati
SUK 	Sukuma
SUN 	Sundanese
SUS 	Susu
SUX 	Sumerian
SWA 	Swahili
SWE 	Swedish
SYR 	Syriac
TAH 	Tahitian
TAI 	Tai (Other)
TAM 	Tamil
TAT 	Tatar
TEL 	Telugu
TEM 	Timne
TER 	Tereno
TET 	Tetum
TGK 	Tajik
TGL 	Tagalog
THA 	Thai
TIB 	Tibetan
TIG 	Tigre
TIR 	Tigrinya
TIV 	Tiv
TKL 	Tokelau
TLI 	Tlingit
TMH 	Tamashek
TOG 	Tonga (Nyasa)
TON 	Tonga (Tonga Islands)
TPI 	Tok Pisin
TSI 	Tsimshian
TSN 	Tswana
TSO 	Tsonga
TUK 	Turkmen
TUM 	Tumbuka
TUP 	Tupi languages
TUR 	Turkish
TUT 	Altaic (Other)
TVL 	Tuvalu
TWI 	Twi
TYV 	Tuvinian
UGA 	Ugaritic
UIG 	Uighur
UKR 	Ukrainian
UMB 	Umbundu
UND 	Undetermined
URD 	Urdu
UZB 	Uzbek
VAI 	Vai
VEN 	Venda
VIE 	Vietnamese
VOL 	Volapük
VOT 	Votic
WAK 	Wakashan languages
WAL 	Walamo
WAR 	Waray
WAS 	Washo
WEL 	Welsh
WEN 	Sorbian languages
WLN 	Walloon
WOL 	Wolof
XHO 	Xhosa
YAO 	Yao
YAP 	Yapese
YID 	Yiddish
YOR 	Yoruba
YPK 	Yupik languages
ZAP 	Zapotec
ZEN 	Zenaga
ZHA 	Zhuang, Chuang
ZND 	Zande
ZUL 	Zulu
ZUN 	Zuni
777 	Refusal*
888 	Don't know*
999 	No answer*

*) Missing Value
lnghomb
Language most often spoken at home: second mentioned
ASK ALL
What language or languages do you speak most often at home? Language 2
[to be coded into ISO693-2]. WRITE IN UP TO 2 LANGUAGES
Value 	Category
AAR 	Afar
ABK 	Abkhazian
ACE 	Achinese
ACH 	Acoli
ADA 	Adangme
AFA 	Afro-Asiatic (Other)
AFH 	Afrihili
AFR 	Afrikaans
AKA 	Akan
AKK 	Akkadian
ALB 	Albanian
ALE 	Aleut
ALG 	Algonquian languages
AMH 	Amharic
ANG 	English, Old (ca.450-1100)
APA 	Apache languages
ARA 	Arabic
ARC 	Aramaic
ARM 	Armenian
ARN 	Araucanian
ARP 	Arapaho
ART 	Artificial (Other)
ARW 	Arawak
ASM 	Assamese
AST 	Asturian, Bable
ATH 	Athapascan languages
AUS 	Australian languages
AVA 	Avaric
AVE 	Avestan
AWA 	Awadhi
AYM 	Aymara
AZE 	Azerbaijani
BAD 	Banda
BAI 	Bamileke languages
BAK 	Bashkir
BAL 	Baluchi
BAM 	Bambara
BAN 	Balinese
BAQ 	Basque
BAS 	Basa
BAT 	Baltic (Other)
BEJ 	Beja
BEL 	Belarusian
BEM 	Bemba
BEN 	Bengali
BER 	Berber (Other)
BHO 	Bhojpuri
BIH 	Bihari
BIK 	Bikol
BIN 	Bini
BIS 	Bislama
BLA 	Siksika
BNT 	Bantu (Other)
BOS 	Bosnian
BRA 	Braj
BRE 	Breton
BTK 	Batak (Indonesia)
BUA 	Buriat
BUG 	Buginese
BUL 	Bulgarian
BUR 	Burmese
CAD 	Caddo
CAI 	Central American Indian (Other)
CAR 	Carib
CAT 	Catalan
CAU 	Caucasian (Other)
CEB 	Cebuano
CEL 	Celtic (Other)
CHA 	Chamorro
CHB 	Chibcha
CHE 	Chechen
CHG 	Chagatai
CHI 	Chinese
CHK 	Chuukese
CHM 	Mari
CHN 	Chinook jargon
CHO 	Choctaw
CHP 	Chipewyan
CHR 	Cherokee
CHU 	Old/Church Slavic, Slavonic, Bulgarian
CHV 	Chuvash
CHY 	Cheyenne
CMC 	Chamic languages
COP 	Coptic
COR 	Cornish
COS 	Corsican
CPE 	Creoles and pidgins, English-based (Other)
CPF 	Creoles and pidgins, French-based (Other)
CPP 	Creoles and pidgins, Portuguese-based (Other)
CRE 	Cree
CRP 	Creoles and pidgins(Other)
CUS 	Cushitic (Other)
CZE 	Czech
DAK 	Dakota
DAN 	Danish
DAY 	Dayak
DEL 	Delaware
DEN 	Slave (Athapascan)
DGR 	Dogrib
DIN 	Dinka
DIV 	Divehi
DOI 	Dogri
DRA 	Dravidian (Other)
DUA 	Duala
DUM 	Dutch, Middle (ca. 1050-1350)
DUT 	Dutch
DYU 	Dyula
DZO 	Dzongkha
EFI 	Efik
EGY 	Egyptian (Ancient)
EKA 	Ekajuk
ELX 	Elamite
ENG 	English
ENM 	English, Middle (1100-1500)
EPO 	Esperanto
EST 	Estonian
EWE 	Ewe
EWO 	Ewondo
FAN 	Fang
FAO 	Faroese
FAT 	Fanti
FIJ 	Fijian
FIN 	Finnish
FIU 	Finno-Ugrian (Other)
FON 	Fon
FRE 	French
FRM 	French, Middle (ca.1400-1600)
FRO 	French, Old (842-ca.1400)
FRY 	Frisian
FUL 	Fulah
FUR 	Friulian
GAA 	Ga
GAY 	Gayo
GBA 	Gbaya
GEM 	Germanic (Other)
GEO 	Georgian
GER 	German
GEZ 	Geez
GIL 	Gilbertese
GLA 	Gaelic Scottish
GLE 	Irish
GLG 	Gallegan
GLV 	Manx
GMH 	German, Middle High (ca.1050-1500)
GOH 	German, Old High (ca.750-1050)
GON 	Gondi
GOR 	Gorontalo
GOT 	Gothic
GRB 	Grebo
GRC 	Greek, Ancient (to 1453)
GRE 	Greek, Modern (1453-)
GRN 	Guarani
GUJ 	Gujarati
GWI 	Gwich'in
HAI 	Haida
HAU 	Hausa
HAW 	Hawaiian
HEB 	Hebrew
HER 	Herero
HIL 	Hiligaynon
HIM 	Himachali
HIN 	Hindi
HIT 	Hittite
HMN 	Hmong
HMO 	Hiri Motu
HUN 	Hungarian
HUP 	Hupa
IBA 	Iban
IBO 	Igbo
ICE 	Icelandic
IDO 	Ido
IJO 	Ijo
IKU 	Inuktitut
ILE 	Interlingue
ILO 	Iloko
INA 	Interlingua (International Auxiliary Language Association)
INC 	Indic (Other)
IND 	Indonesian
INE 	Indo-European (Other)
IPK 	Inupiaq
IRA 	Iranian (Other)
IRO 	Iroquoian languages
ITA 	Italian
JAV 	Javanese
JPN 	Japanese
JPR 	Judeo-Persian
JRB 	Judeo-Arabic
KAA 	Kara-Kalpak
KAB 	Kabyle
KAC 	Kachin
KAL 	Kalaallisut
KAM 	Kamba
KAN 	Kannada
KAR 	Karen
KAS 	Kashmiri
KAU 	Kanuri
KAW 	Kawi
KAZ 	Kazakh
KHA 	Khasi
KHI 	Khoisan (Other)
KHM 	Khmer
KHO 	Khotanese
KIK 	Kikuyu
KIN 	Kinyarwanda
KIR 	Kirghiz
KMB 	Kimbundu
KOK 	Konkani
KOM 	Komi
KON 	Kongo
KOR 	Korean
KOS 	Kosraean
KPE 	Kpelle
KRO 	Kru
KRU 	Kurukh
KUA 	Kuanyama
KUM 	Kumyk
KUR 	Kurdish
KUT 	Kutenai
LAD 	Ladino
LAH 	Lahnda
LAM 	Lamba
LAO 	Lao
LAT 	Latin
LAV 	Latvian
LEZ 	Lezghian
LIN 	Lingala
LIT 	Lithuanian
LOL 	Mongo
LOZ 	Lozi
LTZ 	Luxembourgish, Letzeburgesch
LUA 	Luba-Lulua
LUB 	Luba-Katanga
LUG 	Ganda
LUI 	Luiseno
LUN 	Lunda
LUO 	Luo (Kenya and Tanzania)
LUS 	Lushai
MAC 	Macedonian
MAD 	Madurese
MAG 	Magahi
MAH 	Marshallese
MAI 	Maithili
MAK 	Makasar
MAL 	Malayalam
MAN 	Mandingo
MAO 	Maori
MAP 	Austronesian (Other)
MAR 	Marathi
MAS 	Masai
MAY 	Malay
MDR 	Mandar
MEN 	Mende
MGA 	Irish, Middle (900-1200)
MIC 	Micmac
MIN 	Minangkabau
MIS 	Miscellaneous languages
MKH 	Mon-Khmer (Other)
MLG 	Malagasy
MLT 	Maltese
MNC 	Manchu
MNI 	Manipuri
MNO 	Manobo languages
MOH 	Mohawk
MOL 	Moldavian
MON 	Mongolian
MOS 	Mossi
MUL 	Multiple languages
MUN 	Munda languages
MUS 	Creek
MWR 	Marwari
MYN 	Mayan languages
NAH 	Nahuatl
NAI 	North American Indian (Other)
NAU 	Nauru
NAV 	Navaho
NBL 	Ndebele, South
NDE 	Ndebele, North
NDO 	Ndonga
NDS 	Low German, Saxon
NEP 	Nepali
NEW 	Newari
NIA 	Nias
NIC 	Niger-Kordofanian (Other)
NIU 	Niuean
NNO 	Norwegian Nynorsk
NOB 	Norwegian Bokmål
NON 	Norse, Old
NOR 	Norwegian
NSO 	Sotho, Northern
NUB 	Nubian languages
NYA 	Chewa, Chichewa, Nyanja
NYM 	Nyamwezi
NYN 	Nyankole
NYO 	Nyoro
NZI 	Nzima
OCI 	Provençal, Occitan (post 1500)
OJI 	Ojibwa
ORI 	Oriya
ORM 	Oromo
OSA 	Osage
OSS 	Ossetian
OTA 	Turkish, Ottoman (1500-1928)
OTO 	Otomian languages
PAA 	Papuan (Other)
PAG 	Pangasinan
PAL 	Pahlavi
PAM 	Pampanga
PAN 	Panjabi
PAP 	Papiamento
PAU 	Palauan
PEO 	Persian, Old (ca.600-400)
PER 	Persian
PHI 	Philippine (Other)
PHN 	Phoenician
PLI 	Pali
POL 	Polish
PON 	Pohnpeian
POR 	Portuguese
PRA 	Prakrit languages
PRO 	Provençal, Old (to 1500)
PUS 	Pushto
QAA 	Local language, Italy
QTR 	Local languages, Turkey
QUE 	Quechua
RAJ 	Rajasthani
RAP 	Rapanui
RAR 	Rarotongan
ROA 	Romance (Other)
ROH 	Raeto-Romance
ROM 	Romany
RUM 	Romanian
RUN 	Rundi
RUS 	Russian
SAD 	Sandawe
SAG 	Sango
SAH 	Yakut
SAI 	South American Indian (Other)
SAL 	Salishan languages
SAM 	Samaritan Aramaic
SAN 	Sanskrit
SAS 	Sasak
SAT 	Santali
SCC 	Serbian
SCO 	Scots
SCR 	Croatian
SEL 	Selkup
SEM 	Semitic (Other)
SGA 	Irish, Old (to 900)
SGN 	Sign languages
SHN 	Shan
SID 	Sidamo
SIN 	Sinhalese
SIO 	Siouan languages
SIT 	Sino-Tibetan (Other)
SLA 	Slavic (Other)
SLO 	Slovak
SLV 	Slovenian
SMA 	Southern Sami
SME 	Northern Sami
SMI 	Sami languages (Other)
SMJ 	Lule Sami
SMN 	Inari Sami
SMO 	Samoan
SMS 	Skolt Sami
SNA 	Shona
SND 	Sindhi
SNK 	Soninke
SOG 	Sogdian
SOM 	Somali
SON 	Songhai
SOT 	Sotho, Southern
SPA 	Spanish, Castilian
SRD 	Sardinian
SRR 	Serer
SSA 	Nilo-Saharan (Other)
SSW 	Swati
SUK 	Sukuma
SUN 	Sundanese
SUS 	Susu
SUX 	Sumerian
SWA 	Swahili
SWE 	Swedish
SYR 	Syriac
TAH 	Tahitian
TAI 	Tai (Other)
TAM 	Tamil
TAT 	Tatar
TEL 	Telugu
TEM 	Timne
TER 	Tereno
TET 	Tetum
TGK 	Tajik
TGL 	Tagalog
THA 	Thai
TIB 	Tibetan
TIG 	Tigre
TIR 	Tigrinya
TIV 	Tiv
TKL 	Tokelau
TLI 	Tlingit
TMH 	Tamashek
TOG 	Tonga (Nyasa)
TON 	Tonga (Tonga Islands)
TPI 	Tok Pisin
TSI 	Tsimshian
TSN 	Tswana
TSO 	Tsonga
TUK 	Turkmen
TUM 	Tumbuka
TUP 	Tupi languages
TUR 	Turkish
TUT 	Altaic (Other)
TVL 	Tuvalu
TWI 	Twi
TYV 	Tuvinian
UGA 	Ugaritic
UIG 	Uighur
UKR 	Ukrainian
UMB 	Umbundu
UND 	Undetermined
URD 	Urdu
UZB 	Uzbek
VAI 	Vai
VEN 	Venda
VIE 	Vietnamese
VOL 	Volapük
VOT 	Votic
WAK 	Wakashan languages
WAL 	Walamo
WAR 	Waray
WAS 	Washo
WEL 	Welsh
WEN 	Sorbian languages
WLN 	Walloon
WOL 	Wolof
XHO 	Xhosa
YAO 	Yao
YAP 	Yapese
YID 	Yiddish
YOR 	Yoruba
YPK 	Yupik languages
ZAP 	Zapotec
ZEN 	Zenaga
ZHA 	Zhuang, Chuang
ZND 	Zande
ZUL 	Zulu
ZUN 	Zuni
000 	No second language mentioned*
777 	Refusal*
888 	Don't know*
999 	No answer*

*) Missing Value
blgetmg
Belong to minority ethnic group in country
Do you belong to a minority ethnic group in [country]?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
facntr
Father born in country
Was your father born in [country]?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
facntn
Continent of birth, father
CARD 23
From which of these continents does your father originally come?
Please use this card
Value 	Category
1 	Europe
2 	Africa
3 	Asia
4 	North America
5 	South America and the Caribbean
6 	Australasia
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
mocntr
Mother born in country
ASK ALL
Was your mother born in [country]?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
mocntn
Continent of birth, mother
CARD 23 AGAIN
From which of these continents does your mother originally come?
Please use this card
Value 	Category
1 	Europe
2 	Africa
3 	Asia
4 	North America
5 	South America and the Caribbean
6 	Australasia
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imgetn
Most immigrants to country of same race/ethnic group as majority
ASK ALL
Thinking of people coming to live in [country] nowadays from other countries, would you say that ...
Value 	Category
1 	Most of same race/ethnic group as majority
2 	Most of different race/ethnic group
3 	About half and half
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
eimgrpc
Immigrants from Europe: most from rich/poor countries
Now thinking about people coming to live in [country] nowadays from other countries within Europe, would you say that ...
Value 	Category
1 	Most from richer European countries
2 	Most from poorer European countries
3 	About half and half
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imgrpc
Immigrants from outside Europe: from rich/poor countries
And what about people who come to live in [country] nowadays from countries outside Europe, would you say that ...
Value 	Category
1 	Most from richer non European countries
2 	Most from poorer non European countries
3 	About half and half
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imsmetn
Allow many/few immigrants of same race/ethnic group as majority
CARD 24
Now, using this card, to what extent do you think [country] should allow people of the same race or ethnic group as most [country] people to come and live here?
Value 	Category
1 	Allow many to come and live here
2 	Allow some
3 	Allow a few
4 	Allow none
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imdfetn
Allow many/few immigrants of different race/ethnic group from majority
STILL CARD 24
How about people of a different race or ethnic group from most [country] people?
Still use this card
Value 	Category
1 	Allow many to come and live here
2 	Allow some
3 	Allow a few
4 	Allow none
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
eimrcnt
Allow many/few immigrants from richer countries in Europe
STILL CARD 24
Now, still using this card, to what extent do you think [country] should allow people from the richer countries in Europe to come and live here?
Value 	Category
1 	Allow many to come and live here
2 	Allow some
3 	Allow a few
4 	Allow none
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
eimpcnt
Allow many/few immigrants from poorer countries in Europe
STILL CARD 24
And how about people from the poorer countries in Europe?
Still use this card
Value 	Category
1 	Allow many to come and live here
2 	Allow some
3 	Allow a few
4 	Allow none
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imrcntr
Allow many/few immigrants from richer countries outside Europe
STILL CARD 24
To what extent do you think [country] should allow people from the richer countries outside Europe to come and live here?
Use the same card
Value 	Category
1 	Allow many to come and live here
2 	Allow some
3 	Allow a few
4 	Allow none
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
impcntr
Allow many/few immigrants from poorer countries outside Europe
STILL CARD 24
How about people from the poorer countries outside Europe?
Use the same card
Value 	Category
1 	Allow many to come and live here
2 	Allow some
3 	Allow a few
4 	Allow none
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
qfimedu
Qualification for immigration: good educational qualifications
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...have good educational qualifications?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
qfimfml
Qualification for immigration: close family living here
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...have close family living here?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
qfimlng
Qualification for immigration: speak country's official language
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...be able to speak [country's official language(s)]?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
qfimchr
Qualification for immigration: christian background
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...come from a Christian background?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
qfimwht
Qualification for immigration: be white
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...be white?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
qfimwlt
Qualification for immigration: be wealthy
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...be wealthy?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
qfimwsk
Qualification for immigration: work skills needed in country
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...have work skills that [country] needs?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
qfimcmt
Qualification for immigration: committed to way of life in country
CARD 25
Please tell me how important you think each of these things should be in deciding whether someone born, brought up and living outside [country] should be able to come and live here. Please use this card. Firstly, how important should it be for them to... ...be committed to the way of life in [country]?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imwgdwn
Average wages/salaries generally brought down by immigrants
CARD 26
Using this card, please say how much you agree or disagree with each of the following statements. Firstly...Average wages and salaries are generally brought down by people coming to live and work here
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imhecop
Immigrants harm economic prospects of the poor more than the rich
CARD 26
Using this card, please say how much you agree or disagree with each of the following statements. Firstly...People who come to live and work here generally harm the economic prospects of the poor more than the rich
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imfljob
Immigrants help to fill jobs where there are shortage of workers
CARD 26
Using this card, please say how much you agree or disagree with each of the following statements. Firstly...People who come to live and work here help to fill jobs where there are shortages of workers
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imunplv
If immigrants are long term unemployed they should be made to leave
CARD 26
Using this card, please say how much you agree or disagree with each of the following statements. Firstly...If people who have come to live and work here are unemployed for a long period, they should be made to leave
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imsmrgt
Immigrants should be given same rights as everyone else
CARD 26
Using this card, please say how much you agree or disagree with each of the following statements. Firstly...People who have come to live here should be given the same rights as everyone else
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imscrlv
If immigrants commit serious crime they should be made to leave
CARD 26
Using this card, please say how much you agree or disagree with each of the following statements. Firstly...If people who have come to live here commit a serious crime, they should be made to leave
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imacrlv
If immigrants commit any crime they should be made to leave
CARD 26
Using this card, please say how much you agree or disagree with each of the following statements. Firstly...If people who have come to live here commit any crime, they should be made to leave
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imtcjob
Immigrants take jobs away in country or create new jobs
CARD 27
Using this card, would you say that people who come to live here generally take jobs away from workers in [country], or generally help to create new jobs?
Value 	Category
0 	Take jobs away
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Create new jobs
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imbleco
Taxes and services: immigrants take out more than they put in or less
CARD 28
Most people who come to live here work and pay taxes. They also use health and welfare services. On balance, do you think people who come here take out more than they put in or put in more than they take out?
Please use this card
Value 	Category
0 	Generally take out more
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Generally put in more
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imbgeco
Immigration bad or good for country's economy
CARD 29
Would you say it is generally bad or good for [country]'s economy that people come to live here from other countries?
Please use this card
Value 	Category
0 	Bad for the economy
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Good for the economy
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imueclt
Country's cultural life undermined or enriched by immigrants
CARD 30
And, using this card, would you say that [country]'s cultural life is generally undermined or enriched by people coming to live here from other countries?
Value 	Category
0 	Cultural life undermined
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Cultural life enriched
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imwbcnt
Immigrants make country worse or better place to live
CARD 31
Is [country] made a worse or a better place to live by people coming to live here from other countries?
Please use this card
Value 	Category
0 	Worse place to live
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Better place to live
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imwbcrm
Immigrants make country's crime problems worse or better
CARD 32
Are [country]'s crime problems made worse or better by people coming to live here from other countries?
Please use this card
Value 	Category
0 	Crime problems made worse
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Crime problems made better
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imbghct
Immigration to country bad or good for home countries in the long run
CARD 33
When people leave their countries to come to live in [country], do you think it has a bad or good effect on those countries in the long run?
Please use this card
Value 	Category
0 	Bad for those countries in the long run
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Good for those countries in the long run
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
ctbfsmv
All countries benefit if people can move where their skills needed
CARD 34
Using this card, please say how much you agree or disagree with the following statements. Firstly...All countries benefit if people can move to countries where their skills are most needed
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imrsprc
Richer countries responsible to accept people from poorer countries
CARD 34
Using this card, please say how much you agree or disagree with the following statements. Firstly...Richer countries have a responsibility to accept people from poorer countries
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imsetbs
Immigrant same race/ethnic group majority: your boss
CARD 35
Now thinking again of people who have come to live in [country] from another country who are of the same race or ethnic group as most [country] people, how much would you mind or not mind if someone like this... ...was appointed as your boss? Please use this card for your answer.
READ OUT
Value 	Category
0 	Not mind at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Mind a lot
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imsetmr
Immigrant same race/ethnic group majority: married close relative
CARD 35
Now thinking again of people who have come to live in [country] from another country who are of the same race or ethnic group as most [country] people, how much would you mind or not mind if someone like this... ...married a close relative of yours? Please use this card again
READ OUT
Value 	Category
0 	Not mind at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Mind a lot
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imdetbs
Immigrant different race/ethnic group majority: your boss
CARD 35 AGAIN
And now thinking of people who have come to live in [country] from another country who are of a different race or ethnic group from most [country] people. How much would you mind or not mind if someone like this... ...was appointed as your boss? Please use the same card
READ OUT
Value 	Category
0 	Not mind at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Mind a lot
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imdetmr
Immigrant different race/ethnic group majority: married close relative
CARD 35 AGAIN
And now thinking of people who have come to live in [country] from another country who are of a different race or ethnic group from most [country] people. How much would you mind or not mind if someone like this... ...married a close relative of yours? Still use this card
READ OUT
Value 	Category
0 	Not mind at all
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Mind a lot
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
idetalv
People of minority race/ ethnic group in ideal living area
CARD 36
Suppose you were choosing where to live. Which of the three types of area on this card would you ideally wish to live in?
Value 	Category
1 	Almost nobody minority race/ethnic group
2 	Some minority race/ethnic group
3 	Many minority race/ethnic group
4 	It would make no difference
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
acetalv
People of minority race/ ethnic group in current living area
CARD 37
And now using this card, how would you describe the area where you currently live?
Value 	Category
1 	Almost nobody minority race/ethnic group
2 	Some minority race/ethnic group
3 	Many minority race/ethnic group
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
pplstrd
Better for a country if almost everyone share customs and traditions
CARD 38
Using this card, please tell me how much you agree or disagree with each of these statements. Firstly ...It is better for a country if almost everyone shares the same customs and traditions
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
vrtrlg
Better for a country if a variety of different religions
CARD 38
Using this card, please tell me how much you agree or disagree with each of these statements. Firstly ...It is better for a country if there are a variety of different religions
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
comnlng
Better for a country if almost everyone speak one common language
CARD 38
Using this card, please tell me how much you agree or disagree with each of these statements. Firstly ...It is better for a country if almost everyone is able to speak at least one common language
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
alwspsc
Immigrant communities should be allowed separate schools
CARD 38
Using this card, please tell me how much you agree or disagree with each of these statements. Firstly ...Communities of people who have come to live here should be allowed to educate their children in their own separate schools if they wish
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
stimrdt
If a country wants to reduce tension it should stop immigration
CARD 38
Using this card, please tell me how much you agree or disagree with each of these statements. Firstly ...If a country wants to reduce tensions it should stop immigration
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
lwdscwp
Law against ethnic discrimination in workplace good/bad for a country
CARD 39
How good or bad are each of these things for a country? Please use this card. Firstly...A law against racial or ethnic discrimination in the workplace. Please use this card for your answer
READ OUT
Value 	Category
0 	Extremely bad
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely good
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
lwpeth
Law against promoting racial or ethnic hatred good/bad for a country
CARD 39
How good or bad are each of these things for a country? Please use this card. Firstly...A law against promoting racial or ethnic hatred
READ OUT
Value 	Category
0 	Extremely bad
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely good
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imgfrnd
Any immigrant friends
Do you have any friends who have come to live in [country] from another country?
PROMPT IN RELATION TO PRECODES
Value 	Category
1 	Yes, several
2 	Yes, a few
3 	No, none at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imgclg
Any immigrant colleagues
Do you have any colleagues at work who have come to live in [country] from another country?
PROMPT IN RELATION TO PRECODES
Value 	Category
1 	Yes, several
2 	Yes, a few
3 	No, none at all
4 	Not currently working
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
shrrfg
Country has more than its fair share of people applying refugee status
CARD 40
Using this card, please say how much you agree or disagree with the following statements. Firstly ...[country] has more than its fair share of people applying for refugee status
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rfgawrk
People applying refugee status allowed to work while cases considered
CARD 40
Using this card, please say how much you agree or disagree with the following statements. Firstly ...While their applications for refugee status are being considered, people should be allowed to work in [country]
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
gvrfgap
Government should be generous judging applications for refugee status
CARD 40
Using this card, please say how much you agree or disagree with the following statements. Firstly ...The government should be generous in judging people's applications for refugee status
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rfgfrpc
Most refugee applicants not in real fear of persecution own countries
CARD 40
Some people come to this country and apply for refugee status on the grounds that they fear persecution in their own country. Using this card, please say how much you agree or disagree with the following statements. Firstly...Most applicants for refugee status aren't in real fear of persecution in their own countries
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rfgdtcn
Refugee applicants kept in detention centres while cases considered
CARD 40
Using this card, please say how much you agree or disagree with the following statements. Firstly ...While their cases are being considered, applicants should be kept in detention centres
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rfggvfn
Financial support to refugee applicants while cases considered
CARD 40
Using this card, please say how much you agree or disagree with the following statements. Firstly ...While their cases are being considered, the [country] government should give financial support to applicants
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rfgbfml
Granted refugees should be entitled to bring close family members
CARD 40
Some people come to this country and apply for refugee status on the grounds that they fear persecution in their own country. Using this card, please say how much you agree or disagree with the following statements. Firstly...Refugees whose applications are granted should be entitled to bring in their close family members
READ OUT
Value 	Category
1 	Agree strongly
2 	Agree
3 	Neither agree nor disagree
4 	Disagree
5 	Disagree strongly
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
noimbro
Of every 100 people in country how many born outside country
Out of every 100 people living in [country], how many do you think were born outside [country]?
WRITE IN .. out of 100
Value 	Category
777 	Refusal*
888 	Don't know*
999 	No answer*

*) Missing Value
cpimpop
Country's number of immigrants compared to European countries same size
CARD 41
Compared to other European countries of about the same size as [country], do you think that more or fewer people to come and live here from other countries?
Please use this card
Value 	Category
1 	Far more come to live in country
2 	More come to live
3 	About the same number
4 	Fewer come to live
5 	Far fewer come to live
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
blncmig
Number of people leaving country compared to coming in
CARD 42
How do you think the number of people leaving [country] nowadays compares to the number coming to live in [country]?
Please use this card
Value 	Category
1 	Many more people leaving
2 	More people leaving
3 	About the same arriving and leaving
4 	More people arriving
5 	Many more people arriving
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
sptcref
Sports/outdoor activity club, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...Firstly, a sports club or club for out-door activities? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sptcna
Sports/outdoor activity club, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...Firstly, a sports club or club for out-door activities? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sptcnn
Sports/outdoor activity club, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...Firstly, a sports club or club for out-door activities? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sptcmmb
Sports/outdoor activity club, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...Firstly, a sports club or club for out-door activities? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sptcptp
Sports/outdoor activity club, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...Firstly, a sports club or club for out-door activities? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sptcdm
Sports/outdoor activity club, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...Firstly, a sports club or club for out-door activities? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sptcvw
Sports/outdoor activity club, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...Firstly, a sports club or club for out-door activities? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sptcfrd
Personal friends in sports/outdoor activity club
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...Firstly, a sports club or club for out-door activities?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
cltofrd
Personal friends in cultural/hobby activity organisation
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...an organisation for cultural or hobby activities?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
trufrd
Personal friends in trade union
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...a trade union?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
prfofrd
Personal friends in business /profession/farmers organisation
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...a business, professional, or farmers' organisation?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
cnsofrd
Personal friends in consumer/automobile organisation
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...a consumer or automobile organisation?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
hmnofrd
Personal friends in humanitarian organisation etc
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...an organisation for humanitarian aid, human rights, minorities, or immigrants?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
epaofrd
Personal friends in environmental/peace/animal organisation
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...an organisation for environmental protection, peace or animal rights?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rlgofrd
Personal friends in religious/church organisation
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...a religious or church organisation?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
prtyfrd
Personal friends in political party
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...a political party?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
setofrd
Personal friends in science/education/teacher organisation
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...an organisation for science, education, or teachers and parents?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
sclcfrd
Personal friends in social club etc.
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...a social club, club for the young, the retired/elderly, women, or friendly societies?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
othvfrd
Personal friends in other voluntary organisation
ASK b)FOR EACH ORGANISATION CODED 1 TO 4 AT a). IF ALL CODED '0', GO TO E13
Do you have personal friends within this organisation? ...any other voluntary organisation such as the ones I've just mentioned?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
cltoref
Cultural/hobby activity organisation, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for cultural or hobby activities? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cltona
Cultural/hobby activity organisation, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for cultural or hobby activities? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cltonn
Cultural/hobby activity organisation, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for cultural or hobby activities? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cltommb
Cultural /hobby activity organisation, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for cultural or hobby activities? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cltoptp
Cultural/hobby activity organisation, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for cultural or hobby activities? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cltodm
Cultural/hobby activity organisation, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for cultural or hobby activities? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cltovw
Cultural/hobby activity organisation, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for cultural or hobby activities? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
truref
Trade union, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a trade union? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
truna
Trade union, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a trade union? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
trunn
Trade union, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a trade union? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
trummb
Trade union, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a trade union? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
truptp
Trade union, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a trade union? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
trudm
Trade union, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a trade union? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
truvw
Trade union, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a trade union? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prforef
Business/profession/farmers organisation, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a business, professional, or farmers' organisation? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prfona
Business/profession/farmers organisation, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a business, professional, or farmers' organisation? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prfonn
Business/profession/farmers organisation, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a business, professional, or farmers' organisation? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prfommb
Business/profession/farmers organisation, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a business, professional, or farmers' organisation? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prfoptp
Business/profession/farmers organisation, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a business, professional, or farmers' organisation? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prfodm
Business/profession/farmer organisation, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a business, professional, or farmers' organisation? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prfovw
Business/profession/farmer organisation last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a business, professional, or farmers' organisation? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cnsoref
Consumer/automobile organisation, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a consumer or automobile organisation? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cnsona
Consumer/automobile organisation, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a consumer or automobile organisation? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cnsonn
Consumer/automobile organisation, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a consumer or automobile organisation? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cnsommb
Consumer/automobile organisation, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a consumer or automobile organisation? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cnsoptp
Consumer/automobile organisation, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a consumer or automobile organisation? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cnsodm
Consumer/automobile organisation, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a consumer or automobile organisation? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
cnsovw
Consumer/automobile organisation, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a consumer or automobile organisation? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
hmnoref
Humanitarian organisation etc., last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for humanitarian aid, human rights, minorities, or immigrants? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
hmnona
Humanitarian organisation etc., last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for humanitarian aid, human rights, minorities, or immigrants? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
hmnonn
Humanitarian organisation etc., last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for humanitarian aid, human rights, minorities, or immigrants? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
hmnommb
Humanitarian organisation etc., last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for humanitarian aid, human rights, minorities, or immigrants? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
hmnoptp
Humanitarian organisation etc., last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for humanitarian aid, human rights, minorities, or immigrants? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
hmnodm
Humanitarian organisation etc., last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for humanitarian aid, human rights, minorities, or immigrants? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
hmnovw
Humanitarian organisation etc., last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for humanitarian aid, human rights, minorities, or immigrants? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
epaoref
Environmental/peace/animal organisation, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for environmental protection, peace or animal rights? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
epaona
Environment/peace/animal organisation, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for environmental protection, peace or animal rights? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
epaonn
Environmental/peace/animal organisation, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for environmental protection, peace or animal rights? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
epaommb
Environmental/peace/animal organisation, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for environmental protection, peace or animal rights? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
epaoptp
Environmental/peace/animal organisation, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for environmental protection, peace or animal rights? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
epaodm
Environmental/peace/animal organisation, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for environmental protection, peace or animal rights? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
epaovw
Environment/peace/animal organisation, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for environmental protection, peace or animal rights? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
rlgoref
Religious/church organisation, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a religious or church organisation? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
rlgona
Religious/church organisation, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a religious or church organisation? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
rlgonn
Religious/church organisation, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a religious or church organisation? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
rlgommb
Religious/church organisation, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a religious or church organisation? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
rlgoptp
Religious/church organisation, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a religious or church organisation? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
rlgodm
Religious/church organisation, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a religious or church organisation? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
rlgovw
Religious/church organisation, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a religious or church organisation? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prtyref
Political party, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a political party? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prtyna
Political party, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a political party? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prtynn
Political party, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a political party? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prtymmb
Political party, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a political party? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prtyptp
Political party, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a political party? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prtydm
Political party, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a political party? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
prtyvw
Political party, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a political party? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
setoref
Science/education/teacher organisation, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for science, education, or teachers and parents? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
setona
Science/education/teacher organisation, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for science, education, or teachers and parents? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
setonn
Science/education/teacher organisation, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for science, education, or teachers and parents? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
setommb
Science/education/teacher organisation, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for science, education, or teachers and parents? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
setoptp
Science/education/teacher organisation, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for science, education, or teachers and parents? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
setodm
Science/education/teacher organisation, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for science, education, or teachers and parents? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
setovw
Science/education/teacher organisation, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...an organisation for science, education, or teachers and parents? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sclcref
Social club etc., last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a social club, club for the young, the retired/elderly, women, or friendly societies? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sclcna
Social club etc., last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a social club, club for the young, the retired/elderly, women, or friendly societies? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sclcnn
Social club etc., last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a social club, club for the young, the retired/elderly, women, or friendly societies? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sclcmmb
Social club etc., last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a social club, club for the young, the retired/elderly, women, or friendly societies? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sclcptp
Social club etc., last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a social club, club for the young, the retired/elderly, women, or friendly societies? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sclcdm
Social club etc., last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a social club, club for the young, the retired/elderly, women, or friendly societies? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
sclcvw
Social club etc., last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...a social club, club for the young, the retired/elderly, women, or friendly societies? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
othvref
Other voluntary organisation, last 12 months: refusal
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...any other voluntary organisation such as the ones I've just mentioned? Refusal
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
othvna
Other voluntary organisation, last 12 months: no answer
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...any other voluntary organisation such as the ones I've just mentioned? No answer
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
othvnn
Other voluntary organisation, last 12 months: none apply
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...any other voluntary organisation such as the ones I've just mentioned? None
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
othvmmb
Other voluntary organisation, last 12 months: member
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...any other voluntary organisation such as the ones I've just mentioned? Member
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
othvptp
Other voluntary organisation, last 12 months: participated
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...any other voluntary organisation such as the ones I've just mentioned? Participated
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
othvdm
Other voluntary organisation, last 12 months: donated money
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...any other voluntary organisation such as the ones I've just mentioned? Donated money
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
othvvw
Other voluntary organisation, last 12 months: voluntary work
CARD 43
For each of the voluntary organisations I will now mention, please use this card to tell me whether any of these things apply to you now or in the last 12 months, and, if so, which. ...any other voluntary organisation such as the ones I've just mentioned? Voluntary work
READ OUT EACH ORGANISATION IN TURN. PROBE:'Which others?' CODE ALL THAT APPLY FOR EACH ORGANISATION
Value 	Category
0 	Not marked
1 	Marked
impfml
Important in life: family
CARD 44
Looking at this card, how important is each of these things in your life. Firstly... ...family?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impfrds
Important in life: friends
CARD 44
Looking at this card, how important is each of these things in your life. Firstly... ...friends?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
implsrt
Important in life: leisure time
CARD 44
Looking at this card, how important is each of these things in your life. Firstly... ...leisure time?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imppol
Important in life: politics
CARD 44
Looking at this card, how important is each of these things in your life. Firstly... ...politics?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impwrk
Important in life: work
CARD 44
Looking at this card, how important is each of these things in your life. Firstly... ...work?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imprlg
Important in life: religion
CARD 44
Looking at this card, how important is each of these things in your life. Firstly... ...religion?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impvo
Important in life: voluntary organisations
CARD 44
Looking at this card, how important is each of these things in your life. Firstly... ...voluntary organisations?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
hlpppl
Help others not counting work/voluntary organisations, how often
CARD 45
Not counting anything you do for your family, in your work, or within voluntary organisations, how often, if at all, do you actively provide help for other people?
Value 	Category
1 	Every day
2 	Several times a week
3 	Once a week
4 	Several times a month
5 	Once a month
6 	Less often
7 	Never
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
discpol
Discuss politics/current affairs, how often
CARD 45 AGAIN
Still using this card, how often would you say you discuss politics and current affairs?
Please use this card
Value 	Category
1 	Every day
2 	Several times a week
3 	Once a week
4 	Several times a month
5 	Once a month
6 	Less often
7 	Never
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impsppl
To be a good citizen: how important to support people worse off
CARD 46
To be a good citizen, how important would you say it is for a person to... ...support people who are worse off than themselves?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impvote
To be a good citizen: how important to vote in elections
CARD 46
To be a good citizen, how important would you say it is for a person to... ...vote in elections?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impoblw
To be a good citizen: how important to always obey laws/regulations
CARD 46
To be a good citizen, how important would you say it is for a person to... ...always obey laws and regulations?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impopin
To be a good citizen: how important to form independent opinion
CARD 46
To be a good citizen, how important would you say it is for a person to... ...form their own opinion, independently of others?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impavo
Good citizen: how important to be active in voluntary organisations
CARD 46
To be a good citizen, how important would you say it is for a person to... ...be active in voluntary organisations?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
impapol
To be a good citizen: how important to be active in politics
CARD 46
To be a good citizen, how important would you say it is for a person to... ...be active in politics?
READ OUT
Value 	Category
0 	Extremely unimportant
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely important
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
yrlvdae
How long lived in this area
How long have you lived in this area?
ENTER TO NEAREST YEAR
Value 	Category
777 	Refusal*
888 	Don't know*
999 	No answer*

*) Missing Value
empl
Employment status
Can I just check, are you currently ...
READ OUT
Value 	Category
1 	Employed
2 	Self-employed
3 	Not in paid work
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
wrkflex
Allowed to be flexible in working hours
CARD 47
I am going to read out a list of things about your working life. Using this card, please say how much the management at your work allows you ...to be flexible in your working hours?
READ OUT
Value 	Category
0 	I have no influence
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	I have complete control
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
wkdcorg
Allowed to decide how daily work is organised
CARD 47
I am going to read out a list of things about your working life. Using this card, please say how much the management at your work allows you ...to decide how your own daily work is organised?
READ OUT
Value 	Category
0 	I have no influence
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	I have complete control
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
wkenvin
Allowed to influence job environment
CARD 47
I am going to read out a list of things about your working life. Using this card, please say how much the management at your work allows you ...to influence your environment?
READ OUT
Value 	Category
0 	I have no influence
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	I have complete control
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
wkdcsin
Allowed to influence decisions about work direction
CARD 47
I am going to read out a list of things about your working life. Using this card, please say how much the management at your work allows you ...to influence decisions about the general direction of your work?
READ OUT
Value 	Category
0 	I have no influence
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	I have complete control
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
wkchtsk
Allowed to change work tasks
CARD 47
I am going to read out a list of things about your working life. Using this card, please say how much the management at your work allows you ...to change your work tasks if you wish to?
READ OUT
Value 	Category
0 	I have no influence
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	I have complete control
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
smbtjob
Get a similar or better job with another employer
CARD 48
Now using this card, how difficult or easy would it be for you... ...to get a similar or better job with another employer if you wanted to?
READ OUT
Value 	Category
0 	Extremely difficult
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely easy
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
strtbsn
Start own business
CARD 48
Now using this card, how difficult or easy would it be for you... ...to start your own business if you wanted to?
READ OUT
Value 	Category
0 	Extremely difficult
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely easy
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
truwrkp
Trade union at workplace
Can I just check, is there a trade union or similar organisation at your work place?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
trusay
Difficult or easy to have a say in actions taken by trade union
STILL CARD 48
How difficult or easy is it... ...to have a say in the actions taken by the trade union?
READ OUT
Value 	Category
0 	Extremely difficult
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely easy
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
truiwkp
Difficult or easy for trade union influence conditions at workplace
STILL CARD 48
How difficult or easy is it... ...for the trade union to influence conditions at your place of work?
READ OUT
Value 	Category
0 	Extremely difficult
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely easy
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
stfhwkp
Satisfaction with the way things handled at workplace last 12 months
CARD 49
During the last 12 months, how satisfied or dissatisfied have you generally been with the way things have been handled in your work or workplace?
Please use this card
Value 	Category
0 	Extremely dissatisfied
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Extremely satisfied
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
imprwkc
Attempted to improve work conditions last 12 months
During the last 12 months, have you made any attempt to improve conditions at work, or to prevent them from getting worse?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imprwcr
Did any improvement of work conditions result from the attempt
Did any improvements result?
Value 	Category
1 	Yes
2 	No
3 	Still uncertain
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imprwct
Fairly or unfairly treated in attempt to improve things at work
CARD 50
Regardless of the outcome, how fairly or unfairly were you treated in your attempt to improve things at work?
Please use this card
Value 	Category
0 	Treated very unfairly
1 	1
2 	2
3 	3
4 	4
5 	5
6 	6
7 	7
8 	8
9 	9
10 	Treated very fairly
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
hhmmb
Number of people living regularly as member of household
Including yourself, how many people - including children - live here regularly as members of this household?
WRITE IN NUMBER
Value 	Category
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
gndr
Gender
CODE SEX, respondent
Value 	Category
1 	Male
2 	Female
9 	No answer*

*) Missing Value
gndr2
Gender of second person in household
CODE SEX (2. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr3
Gender of third person in household
CODE SEX (3. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr4
Gender of fourth person in household
CODE SEX (4. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr5
Gender of fifth person in household
CODE SEX (5. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr6
Gender of sixth person in household
CODE SEX (6. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr7
Gender of seventh person in household
CODE SEX (7. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr8
Gender of eighth person in household
CODE SEX (8. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr9
Gender of ninth person in household
CODE SEX (9. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr10
Gender of tenth person in household
CODE SEX (10. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr11
Gender of eleventh person in household
CODE SEX (11. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr12
Gender of twelfth person in household
CODE SEX (12. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr13
Gender of thirteenth person in household
CODE SEX (13. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr14
Gender of fourteenth person in household
CODE SEX (14. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
gndr15
Gender of fifteenth person in household
CODE SEX (15. person in household)
Value 	Category
1 	Male
2 	Female
6 	Not applicable*
7 	Refusal*
9 	No answer*

*) Missing Value
yrbrn
Year of birth
And in what year were you born?
Value 	Category
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
agea
Age of respondent, calculated
Value 	Category
999 	Not available*

*) Missing Value
yrbrn2
Year of birth of second person in household
And in what year was he/she born? (2. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn3
Year of birth of third person in household
And in what year was he/she born? (3. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn4
Year of birth of fourth person in household
And in what year was he/she born? (4. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn5
Year of birth of fifth person in household
And in what year was he/she born? (5.person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn6
Year of birth of sixth person in household
And in what year was he/she born? (6. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn7
Year of birth of seventh person in household
And in what year was he/she born? (7. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn8
Year of birth of eighth person in household
And in what year was he/she born? (8. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn9
Year of birth of ninth person in household
And in what year was he/she born? (9. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn10
Year of birth of tenth person in household
And in what year was he/she born? (10. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn11
Year of birth of eleventh person in household
And in what year was he/she born? (11. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn12
Year of birth of twelfth person in household
And in what year was he/she born? (12. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn13
Year of birth of thirteenth person in household
And in what year was he/she born? (13. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn14
Year of birth of fourteenth person in household
And in what year was he/she born? (14. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
yrbrn15
Year of birth of fifteenth person in household
And in what year was he/she born? (15. person in household)
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
rship2
Second person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (2. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship3
Third person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (3. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship4
Fourth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (4. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship5
Fifth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (5. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship6
Sixth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (6. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship7
Seventh person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (7. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship8
Eighth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (8. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship9
Ninth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (9. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship10
Tenth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (10. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship11
Eleventh person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (11. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship12
Twelfth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (12. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship13
Thirteenth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (13. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship14
Fourteenth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (14. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
rship15
Fifteenth person in household: relationship to respondent
CARD 51
Looking at this card, what relationship is he/she to you? (15. person in household)
Value 	Category
1 	Husband/wife/partner
2 	Son/daughter/step/adopted
3 	Parent/parent-in-law
4 	Other relative
5 	Other non-relative
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
domicil
Domicile, respondent's description
CARD 52
Which phrase on this card best describes the area where you live?
Value 	Category
1 	A big city
2 	Suburbs or outskirts of big city
3 	Town or small city
4 	Country village
5 	Farm or home in countryside
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
edulvla
Highest level of education
CARD 53
What is the highest level of education you have achieved?
Please use this card
Value 	Category
0 	Not possible to harmonise into 5-level ISCED
1 	Less than lower secondary education (ISCED 0-1)
2 	Lower secondary education completed (ISCED 2)
3 	Upper secondary education completed (ISCED 3)
4 	Post-secondary non-tertiary education completed (ISCED 4)
5 	Tertiary education completed (ISCED 5-6)
55 	Other
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
eisced
Highest level of education, ES - ISCED
CARD 53
Generated variable: Highest level of education, ES - ISCED
Please use this card
Value 	Category
0 	Not possible to harmonise into ES-ISCED
1 	ES-ISCED I , less than lower secondary
2 	ES-ISCED II, lower secondary
3 	ES-ISCED IIIb, lower tier upper secondary
4 	ES-ISCED IIIa, upper tier upper secondary
5 	ES-ISCED IV, advanced vocational, sub-degree
6 	ES-ISCED V1, lower tertiary education, BA level
7 	ES-ISCED V2, higher tertiary education, >= MA level
55 	Other
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvbe
Highest level of education, Belgium
CARD 53
What is the highest level of education you have achieved? (Belgium)
Please use this card
Value 	Category
0 	Not completed primary education
1 	Primary, basic, and special primary education
2 	lower secondary vocational education
3 	lower secondary general education
4 	higher secondary vocational education
5 	higher secondary technical, or 7th year vocational education
6 	higher secondary general education
7 	higher education, short type (HOKT)
8 	higher education, long type (HOLT)
9 	university education
10 	doctoral and postdoctoral education
11 	other
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvch
Highest level of education, Switzerland
CARD 53
What is the highest level of education you have achieved? (Switzerland)
Please use this card
Value 	Category
1 	Incomplete compulsory school
2 	Compulsory school
3 	Elementary vocational training (enterprise + school)
4 	Secondary school (Maturity)
5 	Graduation diploma school (Maturity professional)
6 	1 year: school of commerce/domestic science school
7 	Apprenticeship
8 	2 to 3 years: general training school
9 	2 to 3 years: full time vocational school
10 	Vocational higher education (with special degree)
11 	Technical or vocational school (2 yrs full/ 3 yrs part time)
12 	Technical or vocational high school (specialized)
13 	University (3years, short bachelor's degree)
14 	University (4years and more, bachelor's degree)
15 	University (masters, post-grade)
16 	Other education
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvcz
Highest level of education, Czechia
CARD 53
What is the highest level of education you have achieved? (Czechia)
Please use this card
Value 	Category
0 	Uncompleted primary
1 	Primary
2 	Vocational, no upper diploma
3 	Secondary, no upper diploma
4 	Vocational, diploma
5 	Secondary technical, diploma
6 	Secondary academic, diploma
7 	Higher
8 	Tertiary, Bc.
9 	Tertiary, M.A.
10 	Post-graduate
11 	Other
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvdk
Highest level of education, Denmark
CARD 53
What is the highest level of education you have achieved? (Denmark)
Please use this card
Value 	Category
0 	No school education, no vocational education
1 	1.-6. class in school, no vocational education
2 	7.-10. class in school, no vocational education
3 	Upper secondary school, no vocational education
4 	Vocational education and training, apprenticeship training a
5 	Work leader education for vocational educated
6 	Further education of 2-3 years after upper secondary school
7 	Further education of around 4 years after upper secondary sc
8 	Bachelors or masters degree from university
9 	Further university education i.e. ph.d.
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlves
Highest level of education, Spain
CARD 53
What is the highest level of education you have achieved? (Spain)
Please use this card
Value 	Category
0 	No studies/illiterate
1 	Not completed primary education
2 	Primary education
3 	Degree of primary education
4 	Vocational education, first cycle
5 	Secondary education
6 	Vocational education, second cycle
7 	2 or 3 years higher education (not leading to a university d
8 	Polytechnical studies, short cycle: technical architect or t
9 	Other short cycle university degree (3 years)
10 	Polytechnical studies, long cycle: architect, engineer (5 ye
11 	Other long cycle university degree (5 years or more)
12 	Postgraduate degree
13 	Doctoral degree
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvfr
Highest level of education, France
CARD 53
What is the highest level of education you have achieved? (France)
Please use this card
Value 	Category
1 	Sans diplôme
2 	Non diplômés jusqu'à la fin 3ème, 2nde, 1ère filière général
3 	Non diplômés du CAP BEP filière professionnelle
4 	Certificat d'études primaires
5 	CAP, examen de fin d'apprentissage artisanal
6 	BEP, BP, BEA, BEC, BEI, BES
7 	Brevet élementaire, brevet d'étude du premier cycle, brevet
8 	Baccalauréat général, brevet supérieur
9 	Brevet de technicien, baccalauréat de technicien, baccalauré
10 	Diplôme universitaire du premier cycle (DEUG), diplôme unive
11 	Diplôme universitaire des deuxième et troisième cycles, Doct
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvgb
Highest level of education, United Kingdom
CARD 53
What is the highest level of education you have achieved? (United Kingdom)
Please use this card
Value 	Category
0 	No qualifications
1 	GCSE/O-level/CSE/NVQ1/NVQ2 or equiv
2 	A-level/NVQ3 or equiv
3 	NVQ4/NVQ5 or equiv
4 	Degree/HNC/teacher training/nursing or equiv
5 	PhD/DPhil or equiv
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvgr
Highest level of education, Greece
CARD 53
What is the highest level of education you have achieved? (Greece)
Please use this card
Value 	Category
1 	Illiterate/not completed primary
2 	Primary
3 	Partial secondary
4 	Full secondary
5 	Post secondary/polytechnic
6 	University degree
7 	Post graduate degree
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvhu
Highest level of education, Hungary
CARD 53
What is the highest level of education you have achieved? (Hungary)
Please use this card
Value 	Category
1 	Never attented school
2 	1-4 form in primary school
3 	5-7 form in primary school
4 	Completed primary school
5 	Trade school
6 	Not completed secondary school
7 	Completed secondary school
8 	Not completed university/college
9 	College
10 	University
11 	Postgraduate studies
12 	Degree/PhD
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvie
Highest level of education, Ireland
CARD 53
What is the highest level of education you have achieved? (Ireland)
Please use this card
Value 	Category
1 	None/primary not completed
2 	Primary or equivalent
3 	Intermediate/junior/group cert or equiv
4 	Leaving cert or equivalent
5 	Diploma/certificate
6 	Primary degree
7 	Postgraduate/higher degree
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvil
Highest level of education, Israel
CARD 53
What is the highest level of education you have achieved? (Israel)
Please use this card
Value 	Category
0 	No formal qualification
1 	Lowest formal qualification
2 	Not finish vocational high school
3 	Full voc hs without matriculation certificate
4 	Full voc hs with matriculation certificate
5 	Not finish general high school
6 	Full general hs without matriculation certificate
7 	Full general hs with matriculation certificate
8 	Yeshiva hs without full matriculation certificate
9 	Yeshiva hs with full matriculation certificate
10 	Post secondary
11 	Not finish University degree
12 	University Ba degree completed
13 	University Ma /Phd degree completed
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvit
Highest level of education, Italy
CARD 53
What is the highest level of education you have achieved? (Italy)
Please use this card
Value 	Category
1 	Senza titolo
2 	Licenza elementare
3 	Licenza media / avviamento professionale
4 	Diploma scuola media superiore
5 	Diploma universitario
6 	Laurea
7 	Specializzazione post-laurea
8 	Altro
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvlu
Highest level of education, Luxembourg
CARD 53
What is the highest level of education you have achieved? (Luxembourg)
Please use this card
Value 	Category
0 	No qualification
1 	Primary school
2 	Upper primary school
3 	Complementary school
4 	Lower technical secundary school
5 	Craftsman diploma
6 	Skilled craftsman
7 	First professional diploma
8 	Second professional diploma
9 	First technical high school diploma
10 	Second technical high school
11 	General lower secondary school
12 	Secondary diploma
13 	Master craftsman diploma
14 	High school + 2 years university
15 	High school + 3 years university
16 	High school + 4 years university
17 	High school + 5 years university without obt. dipl.
18 	Doctorate, PhD
19 	Other
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvnl
Highest level of education, Netherlands
CARD 53
What is the highest level of education you have achieved? (Netherlands)
Please use this card
Value 	Category
1 	Niet voltooid lager onderwijs
2 	Lager onderwijs (LO), Basisschool, Lager speciaal onderwijs
3 	Lager Beroepsonderwijs (LBO), Lagere Technische School (LTS)
4 	Middelbaar Algemeen Voortgezet Onderwijs (MAVO)
5 	Kort Middelbaar Beroepsonderwijs (KMBO)
6 	Middelbaar Beroepsonderwijs (MBO), Beroepsopleidende leerweg
7 	MBO-plus voor toegang tot het HBO korte HBO-opleiding
8 	Hoger Algemeen Voortgezet Onderwijs (HAVO)
9 	Voorbereidend Wetenschappelijk Onderwijs (VWO)
10 	Hoger Beroepsonderwijs (HBO)
11 	Wetenschappelijk Onderwijs (WO)
12 	Postdoctorale opleiding
13 	Aio/Oio of andere promotie-opleiding tot graad van doctor
14 	Anders
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvno
Highest level of education, Norway
CARD 53
What is the highest level of education you have achieved? (Norway)
Please use this card
Value 	Category
0 	No education
1 	Primary education (1st. - 7th. class level)
2 	Lower secondary education
3 	Upper secondary, basic (11th. - 12th. class level)
4 	Upper secondary, final year (13th. class level+)
5 	Post-secondary non-tertiary education (14th. class level+)
6 	Tertiary education, short (higher education 4 years or shorter)
7 	Tertiary education, long (higher education more than 4 years)
8 	Doctoral Degree
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvpl
Highest level of education, Poland
CARD 53
What is the highest level of education you have achieved? (Poland)
Please use this card
Value 	Category
1 	Not completed primary education
2 	Primary completed
3 	Lower secondary
4 	Basic vocational
5 	Secondary not completed
6 	Secondary comprehensive
7 	Secondary vocational
8 	Post secondary
9 	First stage of tertiary
10 	Tertiary not completed
11 	Tertiary completed
12 	Other, not classified
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvpt
Highest level of education, Portugal
CARD 53
What is the highest level of education you have achieved? (Portugal)
Please use this card
Value 	Category
1 	Nenhum
2 	1 ciclo
3 	2 ciclo
4 	3 ciclo
5 	Secundario
6 	Superior Politecnico
7 	Superior Universitario
8 	Mestrado/Doutoramento
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edlvse
Highest level of education, Sweden
CARD 53
What is the highest level of education you have achieved? (Sweden)
Please use this card
Value 	Category
1 	Not finished elementary school
2 	Elementary school, old
3 	Elementary school
4 	Lower secondary and elementary school, old
5 	Vocational school 1963-1970
6 	2 year high school
7 	3-4 year high school prior 1995
8 	Vocational high school after 1992
9 	Theoretical high school after 1992
10 	University, no exam
11 	University, exam less than 3 years
12 	University, exam more than 3 years
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
eduyrs
Years of full-time education completed
About how many years of education have you completed, whether full-time or part-time? Please report these in full-time equivalents and include compulsory years of schooling.
WRITE IN
Value 	Category
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
dngdk
Doing last 7 days: don't know
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Don't know
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dngref
Doing last 7 days: refusal
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Refusal
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dngna
Doing last 7 days: no answer
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? No answer
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
pdwrk
Doing last 7 days: paid work
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? In paid work (or away temporarily) (employee, self-employed, working for your family business)
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
edctn
Doing last 7 days: education
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? In education (not paid for by employer) even if on vacation
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
uempla
Doing last 7 days: unemployed, actively looking for job
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Unemployed and actively looking for a job
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
uempli
Doing last 7 days: unemployed, not actively looking for job
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Unemployed, wanting a job but not actively looking for a job
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dsbld
Doing last 7 days: permanently sick or disabled
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Permanently sick or disabled
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
rtrd
Doing last 7 days: retired
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Retired
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
cmsrv
Doing last 7 days: community or military service
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? In community or military service
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
hswrk
Doing last 7 days: housework, looking after children, others
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Doing housework, looking after children or other persons
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
dngoth
Doing last 7 days: other
CARD 54
Using this card, which of these descriptions applies to what you have been doing for the last 7 days? Other
PROMPT Which others? CODE ALL THAT APPLY
Value 	Category
0 	Not marked
1 	Marked
mainact
Main activity last 7 days
CARD 54 AGAIN
And which of these descriptions best describes your situation (in the last seven days)?
Value 	Category
1 	Paid work
2 	Education
3 	Unemployed, looking for job
4 	Unemployed, not looking for job
5 	Permanently sick or disabled
6 	Retired
7 	Community or military service
8 	Housework, looking after children, others
9 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
mnactic
Main activity, last 7 days. All respondents. Post coded
POST CODE: MAIN ACTIVITY
Value 	Category
1 	Paid work
2 	Education
3 	Unemployed, looking for job
4 	Unemployed, not looking for job
5 	Permanently sick or disabled
6 	Retired
7 	Community or military service
8 	Housework, looking after children, others
9 	Other
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
crpdwk
Control paid work last 7 days
ASK IF NOT IN PAID WORK AT F8a. THOSE IN PAID WORK (CODE 1), GO TO F12.
Can I just check, did you do any paid work of an hour or more in the last seven days?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
pdjobev
Ever had a paid job
Have you ever had a paid job?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
pdjobyr
Year last in paid job
In what year were you last in a paid job?
WRITE IN YEAR
Value 	Category
6666 	Not applicable*
7777 	Refusal*
8888 	Don't know*
9999 	No answer*

*) Missing Value
emplrel
Employment relation
INTERVIEWER: If Respondent currently in work (at F8a or F9), ask F12 to F24 about current job; if not in paid work but had a job in the past (1 at F10), ask F12 to F24 about last job.
In your main job are/were you...
READ OUT
Value 	Category
1 	Employee
2 	Self-employed
3 	Working for own family business
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
emplno
Number of employees respondent has/had
How many employees (if any) do/did you have?
WRITE IN number of employees
Value 	Category
66666 	Not applicable*
77777 	Refusal*
88888 	Don't know*
99999 	No answer*

*) Missing Value
wrkctr
Employment contract unlimited or limited duration
ASK IF EMPLOYEE OR FAMILY BUSINESS OR DON'T KNOW (CODES 1,3,8 AT F12)
Do/did you have a work contract of ...
READ OUT
Value 	Category
1 	Unlimited
2 	Limited
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
wrkctrhu
Employment contract unlimited or limited duration, Hungary
ASK IF EMPLOYEE OR FAMILY BUSINESS OR DON'T KNOW (CODES 1,3,8 AT F12)
Do/did you have a work contract of ...(Hungary)
READ OUT
Value 	Category
1 	Unlimited
2 	Limited
3 	No contract
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
estsz
Establishment size
ASK ALL WORKING/PREVIOUSLY WORKED
Including yourself, about how many people are/were employed at the place where you usually work/worked?
READ OUT
Value 	Category
1 	Under 10
2 	10 to 24
3 	25 to 99
4 	100 to 499
5 	500 or more
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
jbspv
Responsible for supervising other employees
In your main job, do/did you have any responsibility for supervising the work of other employees?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
njbspv
Number of people responsible for in job
How many people are/were you responsible for?
WRITE IN
Value 	Category
66666 	Not applicable*
77777 	Refusal*
88888 	Don't know*
99999 	No answer*

*) Missing Value
orgwrk
To what extent organise own work
ASK ALL WORKING/PREVIOUSLY WORKED
To what extent can/could you organise your own work? Can you...
READ OUT
Value 	Category
1 	To a large extent
2 	To some extent
3 	Very little
4 	Not at all
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
wkhct
Total contracted hours per week in main job overtime excluded
What are/were your total 'basic' or contracted hours each week (in your main job), excluding any paid and unpaid overtime?
WRITE IN HOURS
Value 	Category
666 	Not applicable*
777 	Refusal*
888 	Don't know*
999 	No answer*

*) Missing Value
wkhtot
Total hours normally worked per week in main job overtime included
Regardless of your basic or contracted hours, how many hours do/did you normally work a week (in your main job), including any paid or unpaid overtime
WRITE IN HOURS
Value 	Category
666 	Not applicable*
777 	Refusal*
888 	Don't know*
999 	No answer*

*) Missing Value
iscoco
Occupation, ISCO88 (com)
What is/was the name or title of your main job? In your main job, what kind of work do/did you do most of the time? What training or qualifications are/were needed for the job?
WRITE IN
Value 	Category
100 	Armed forces
1000 	Legislators, senior officials and managers
1100 	Legislators and senior officials
1110 	Legislators, senior government officials
1140 	Senior officials of special-interest org
1141 	Senior officials of political-party org
1142 	Senior officials of economic-interest org
1143 	Senior off human, special-interest org
1200 	Corporate managers
1210 	Directors and chief executives
1220 	Production and operations managers
1221 	Managers agriculture,hunting,forestry,fishing
1222 	Managers in manufacturing
1223 	Managers in construction
1224 	Managers in wholesale and retail trade
1225 	Managers in restaurants and hotels
1226 	Managers transport,storage,communications
1227 	Managers in business services enterprises
1228 	Managers personal care,cleaning,rel serv
1229 	Managers not elsewhere classified
1230 	Other specialist managers
1231 	Finance and administration managers
1232 	Personnel and industrial relations managers
1233 	Sales and marketing managers
1234 	Advertising and public relations managers
1235 	Supply and distribution managers
1236 	Computing services managers
1237 	Research and development managers
1239 	Oth spec managers not elsewhere classified
1300 	Managers of small enterprises
1310 	Managers of small enterprises
1311 	Mngr small ent agr,hunting,forestry,fishing
1312 	Mngr small ent in manufacturing
1313 	Mngr small ent in construction
1314 	Mngr small ent wholesale and retail trade
1315 	Mngr small ent of restaurants and hotels
1316 	Mngr small ent transp,storage,comm
1317 	Mngr small ent of business serv enterpr
1318 	Mngr small ent pers care,cleaning,rel serv
1319 	Mngr small ent not elsewhere classified
2000 	Professionals
2100 	Phys, mathem, engin science professionals
2110 	Physics, chemists, related professionals
2111 	Physicists and astronomers
2112 	Meteorologists
2113 	Chemists
2114 	Geologists and geophysicists
2120 	Mathem, stat, related professionals
2121 	Mathematicians and related professionals
2122 	Statisticians
2130 	Computing professionals
2131 	Comp systems designers,analysts,programmers
2139 	Comp professionals not elsewhere classified
2140 	Architects,engineers,related professionals
2141 	Architects, town and traffic planners
2142 	Civil engineers
2143 	Electrical engineers
2144 	Electronics, telecommunications engineers
2145 	Mechanical engineers
2146 	Chemical engineers
2147 	Mining engineers, metall,rel professionals
2148 	Cartographers and surveyors
2149 	Arch, engin,rel prof not elsewhere class
2200 	Life science and health professionals
2210 	Life science professionals
2211 	Biol,botan,zool and related professionals
2212 	Pharm, pathol and related professionals
2213 	Agronomists and related professionals
2220 	Health professionals (except nursing)
2221 	Medical doctors
2222 	Dentists
2223 	Veterinarians
2224 	Pharmacists
2229 	Health prof (not nursing) not elsew class
2230 	Nursing and midwifery professionals
2300 	Teaching professionals
2310 	Coll,univ, higher educ teaching prof
2320 	Secondary education teaching professionals
2330 	Primary and pre-primary educ teaching prof
2331 	Primary education teaching professionals
2332 	Pre-primary educ teaching professionals
2340 	Special education teaching professionals
2350 	Other teaching professionals
2351 	Education methods specialists
2352 	School inspectors
2359 	Other teaching prof not elsewhere class
2400 	Other professionals
2410 	Business professionals
2411 	Accountants
2412 	Personnel and careers professionals
2419 	Business prof not elsewhere classified
2420 	Legal professionals
2421 	Lawyers
2422 	Judges
2429 	Legal prof not elsewhere classified
2430 	Archiv,libr,related information prof
2431 	Archivists and curators
2432 	Librarians,related information prof
2440 	Social science and related professionals
2441 	Economists
2442 	Sociologists, anthropologists, rel prof
2443 	Philosophers,historians,political scientists
2444 	Philologists, translators and interpreters
2445 	Psychologists
2446 	Social work professionals
2450 	Writers and creative or performing artists
2451 	Authors, journalists and other writers
2452 	Sculptors, painters and related artists
2453 	Composers, musicians and singers
2454 	Choreographers and dancers
2455 	Film, stage and related actors and directors
2460 	Religious professionals
2470 	Public service administrative professionals
3000 	Technicians and associate professionals
3100 	Physical,engineering science associate prof
3110 	Physical,engineering science technicians
3111 	Chemical and physical science technicians
3112 	Civil engineering technicians
3113 	Electrical engineering technicians
3114 	Electronics,telecom engineering technicians
3115 	Mechanical engineering technicians
3116 	Chemical engineering technicians
3117 	Mining and metallurgical technicians
3118 	Draughtspersons
3119 	Phys, engin science techn not elsew class
3120 	Computer associate professionals
3121 	Computer assistants
3122 	Computer equipment operators
3123 	Industrial robot controllers
3130 	Optical and electronic equipment operators
3131 	Photogr,image,sound rec equipment oper
3132 	Broadcasting,telecom equipment operators
3133 	Medical equipment operators
3139 	Optical,electr equipm oper not elsew class
3140 	Ship, aircraft controllers and technicians
3141 	Ships' engineers
3142 	Ships' deck officers and pilots
3143 	Aircraft pilots, related associated prof
3144 	Air traffic controllers
3145 	Air traffic safety technicians
3150 	Safety and quality inspectors
3151 	Building and fire inspectors
3152 	Safety, health and quality inspectors
3200 	Life,science and health associate prof
3210 	Life,science techn and rel associate prof
3211 	Life science technicians
3212 	Agronomy and forestry technicians
3213 	Farming and forestry advisers
3220 	Health associate prof (except nursing)
3221 	Medical assistants
3222 	Hygienists, health environmental officers
3223 	Dieticians and nutritionists
3224 	Optometrists and opticians
3225 	Dental assistants
3226 	Physiotherapists and rel associate prof
3227 	Veterinary assistants
3228 	Pharmaceutical assistants
3229 	Health ass prof excpt nursing not else class
3230 	Nursing midwifery associate prof
3231 	Nursing associate professionals
3232 	Midwifery associate professionals
3300 	Teaching associate professionals
3310 	Primary education teaching associate prof
3320 	Pre-primary edu teaching associate prof
3330 	Special education teaching associate prof
3340 	Other teaching associate professionals
3400 	Other associate professionals
3410 	Finance and sales associate professionals
3411 	Securities and finance dealers and brokers
3412 	Insurance representatives
3413 	Estate agents
3414 	Travel consultants and organisers
3415 	Technical and commercial sales rep
3416 	Buyers
3417 	Appraisers, valuers and auctioneers
3419 	Finance,sales associate prof not else class
3420 	Business services agents and trade brokers
3421 	Trade brokers
3422 	Clearing and forwarding agents
3423 	Employment agents and labour contractors
3429 	Busines,serv,agnts,trde brokr not else class
3430 	Administrative associate professionals
3431 	Adm secretaries, related associate prof
3432 	Legal related business associate prof
3433 	Bookkeepers
3434 	Statistical, mathemat rel associate prof
3440 	Custom,tax,related gov associate prof
3441 	Customs and border inspectors
3442 	Government tax and excise officials
3443 	Government social benefits officials
3444 	Government licensing officials
3449 	Custom,tax,rel gov assoc prof not else class
3450 	Police inspectors and detectives
3460 	Social work associate professionals
3470 	Artistic,entertainment,sports associate prof
3471 	Decorators and commercial designers
3472 	Radio, television and other announcers
3473 	Street,nightclub,rel musicians,singers,dance
3474 	Clowns,magicians,acrobats, rel associate prof
3475 	Athletes,sportspers, related associate prof
3480 	Religious associate professionals
4000 	Clerks
4100 	Office clerks
4110 	Secretaries and keyboard-operating clerks
4111 	Stenographers and typists
4112 	Word-processor and related operators
4113 	Data entry operators
4114 	Calculating-machine operators
4115 	Secretaries
4120 	Numerical clerks
4121 	Accounting and bookkeeping clerks
4122 	Statistical and finance clerks
4130 	Material-recording and transport clerks
4131 	Stock clerks
4132 	Production clerks
4133 	Transport clerks
4140 	Library, mail and related clerks
4141 	Library and filing clerks
4142 	Mail carriers and sorting clerks
4143 	Coding, proof-reading and related clerks
4144 	Scribes and related workers
4190 	Other office clerks
4200 	Customer services clerks
4210 	Cashiers, tellers and related clerks
4211 	Cashiers and ticket clerks
4212 	Tellers and other counter clerks
4213 	Bookmakers and croupiers
4214 	Pawnbrokers and money-lenders
4215 	Debt-collectors and related workers
4220 	Client information clerks
4221 	Travel agency and related clerks
4222 	Receptionists and information clerks
4223 	Telephone switchboard operators
5000 	Service workers,shop, market sales workers
5100 	Personal and protective services workers
5110 	Travel attendants and related workers
5111 	Travel attendants and travel stewards
5112 	Transport conductors
5113 	Travel guides
5120 	Housekeeping, restaurant services workers
5121 	Housekeepers and related workers
5122 	Cooks
5123 	Waiters, waitresses and bartenders
5130 	Personal care and related workers
5131 	Child-care workers
5132 	Institution-based personal care workers
5133 	Home-based personal care workers
5139 	Personal care,related workers not else class
5140 	Other personal services workers
5141 	Hairdress,barber,beautician, related workers
5142 	Companions and valets
5143 	Undertakers and embalmers
5149 	Other pers service workers not else class
5160 	Protective services workers
5161 	Fire-fighters
5162 	Police officers
5163 	Prison guards
5169 	Protective services workers not else class
5200 	Models, salespersons and demonstrators
5210 	Fashion and other models
5220 	Shop,stall,market salespers, demonstrators
6000 	Skilled agricultural and fishery workers
6100 	Skilled agricultural and fishery workers
6110 	Market gardeners and crop growers
6111 	Field crop and vegetable growers
6112 	Gardeners, horticultural, nursery growers
6120 	Animal producers and related workers
6121 	Dairy and livestock producers
6122 	Poultry producers
6129 	Animal prod, related workers not else class
6130 	Crop and animal producers
6140 	Forestry and related workers
6141 	Forestry workers and loggers
6142 	Charcoal burners and related workers
6150 	Fishery workers, hunters and trappers
6151 	Aquatic-life cultivation workers
6152 	Inland and coastal waters fishery workers
6153 	Deep-sea fishery workers
6154 	Hunters and trappers
7000 	Craft and related trades workers
7100 	Extraction and building trades workers
7110 	Miners,shotfirers, stone cutters, carvers
7111 	Miners and quarry workers
7112 	Shotfirers and blasters
7113 	Stone splitters, cutters and carvers
7120 	Building frame and related trades workers
7121 	Builders
7122 	Bricklayers and stonemasons
7123 	Concrete placer,concrete finisher, rel workrs
7124 	Carpenters and joiners
7129 	Build frame, rel trade worker not else class
7130 	Build finishers, related trades workers
7131 	Roofers
7132 	Floor layers and tile setters
7133 	Plasterers
7134 	Insulation workers
7135 	Glaziers
7136 	Plumbers and pipe fitters
7137 	Building and related electricians
7139 	Build finisher,rel trde work not else class
7140 	Painter,building struct cleaner,rel trde work
7141 	Painters and related workers
7143 	Building structure cleaners
7200 	Metal, machinery related trades workers
7210 	Metalm,welder,sheetmet,structmet prep,rel work
7211 	Metal moulders and coremakers
7212 	Welders and flamecutters
7213 	Sheet-metal workers
7214 	Structural-metal preparers and erectors
7215 	Riggers and cable splicers
7216 	Underwater workers
7220 	Blacksmiths,tool-makers,related trad work
7221 	Blacksmith, hammer-smith,forging-press work
7222 	Tool-makers and related workers
7223 	Machine-tool setters and setter-operators
7224 	Metal wheelgrinder, polisher, tool sharpener
7230 	Machinery mechanics and fitters
7231 	Motor vehicle mechanics and fitters
7232 	Aircraft engine mechanics and fitters
7233 	Agric- or industrmachine mechanic and fitter
7240 	Electric,electronic equip mech and fitter
7241 	Electric mechanic, fitters and servicers
7242 	Electronic mecanic, fitters and servicers
7244 	Telegraph, teleph installers and servicers
7245 	Electric line install,repairer,cable jointer
7300 	Precision,handicraft,printing,rel trade work
7310 	Precision workers in metal and rel materials
7311 	Precision-instrument makers and repairers
7312 	Musical instrument makers and tuners
7313 	Jewellery and precious-metal workers
7320 	Potters,glass-makers, related trades workers
7321 	Abrasive wheel former,potter and rel workers
7322 	Glass-makers,cutters,grinders and finishers
7323 	Glass engravers and etchers
7324 	Glass,ceramics and rel decorative painters
7330 	Handicrft work wood,textile,leather,rel matr
7331 	Handicrft work in wood and related material
7332 	Handicrft work in textile,leather,rel mater
7340 	Craft printing and related trades workers
7341 	Compositors,typesetters, related workers
7342 	Stereotypers and electrotypers
7343 	Printing engravers and etchers
7344 	Photographic and related workers
7345 	Bookbinders and related workers
7346 	Silk-screen,block,craft textile printers
7400 	Other craft and related trades workers
7410 	Food processing and related trades workers
7411 	Butchers,fishmongers,related food preparers
7412 	Bakers,pastry-cooks,confectionery maker
7413 	Dairy products workers
7414 	Fruit, vegetable and related preservers
7415 	Food and beverage tasters and graders
7416 	Tobacco preparers,tobacco products maker
7420 	Wood treaters,cabinet-makers,rel trad work
7421 	Wood treaters
7422 	Cabinetmakers and related workers
7423 	Woodworking machine setter,setter-operator
7424 	Basketry weavers,brush makers,rel worker
7430 	Textile,garment, related trades worker
7431 	Fibre preparers
7432 	Weavers, knitters and related workers
7433 	Tailors, dressmakers and hatters
7434 	Furriers and related workers
7435 	Textile,leather,rel patternmakers, cutter
7436 	Sewers, embroiderers and related workers
7437 	Upholsterers and related workers
7440 	Pelt,leather,shoemaking trades worker
7441 	Pelt dressers, tanners and fellmongers
7442 	Shoe-makers and related workers
8000 	Plant and machine operators and assemblers
8100 	Stationary plant and related operators
8110 	Mining, mineral-processing-plant operator
8111 	Mining plant operators
8112 	Mineralore,stone-processing-plant operator
8113 	Well drillers,borers and related worker
8120 	Metal-processing plant operators
8121 	Ore and metal furnace operators
8122 	Metal melters,casters,rolling-mill operator
8123 	Metal-heat-treating-plant operators
8124 	Metal drawers and extruders
8130 	Glass, ceramics,related plant operators
8131 	Glass,ceramics kiln,related machine operator
8139 	Glass,ceramic,rel plant operat not else class
8140 	Wood-processing, papermaking-plant operator
8141 	Wood-processing-plant operators
8142 	Paper-pulp plant operators
8143 	Papermaking-plant operators
8150 	Chemical-processing-plant operators
8151 	Crush,grind,chemicalmixing machinery operat
8152 	Chemical-heat-treating-plant operators
8153 	Chemical,filtering,separating-equip operator
8154 	Chem-still,reactor opt,except petr, nat gas
8155 	Petrol,natural gas refin plant operator
8159 	Chemicalprocess,plant operat not else class
8160 	Power-Prod. and related plant operators
8161 	Power-production plant operators
8162 	Steam-engine and boiler operators
8163 	Incinerator,watertreatment,rel plant operator
8170 	Industrial robot operators
8200 	Machine operators and assemblers
8210 	Metal,mineralproducts machine operator
8211 	Machine-tool operators
8212 	Cement, other mineral prod machine operator
8220 	Chemical-products machine operators
8221 	Pharmaceutical,toiletry-prod machine operat
8222 	Ammunition,explosive products machine operat
8223 	Metal finish, plating,coatingmachine operat
8224 	Photographic-products machine operators
8229 	Chemicalprod, machine operat not else class
8230 	Rubber,plasticproducts machine operator
8231 	Rubber-products machine operators
8232 	Plastic-products machine operators
8240 	Wood-products machine operators
8250 	Printing,binding,paperprod machine operat
8251 	Printing-machine operators
8252 	Bookbinding-machine operators
8253 	Paper-products machine operators
8260 	Textile,fur,leatherprod machine operator
8261 	Fibreprep,spinning winding-machine operat
8262 	Weaving- and knitting-machine operators
8263 	Sewing-machine operators
8264 	Bleaching,dyeing,cleaning-machine operat
8265 	Fur,leatherprep machine operat
8266 	Shoemaking- and related machine operators
8269 	Textl,fur,leatherprod mach operat n else clas
8270 	Food,related products machine operator
8271 	Meat, fishprocess machine operator
8272 	Dairy-products machine operators
8273 	Grain- and spice-milling-machine operators
8274 	Baked g,cereal,chocolateprod machine operat
8275 	Fruit,vegetable,nutprocess-machine operat
8276 	Sugar production machine operators
8277 	Tea, coffee, cocoaprocess-machine operat
8278 	Brewer,wine, other beverage machine operat
8279 	Tobacco production machine operators
8280 	Assemblers
8281 	Mechanical-machinery assemblers
8282 	Electrical-equipment assemblers
8283 	Electronic-equipment assemblers
8284 	Metal,rubber,plastic-prod assemblers
8285 	Wood and related products assemblers
8286 	Paperboard,textile, related prod assembl
8287 	Composite products assemblers
8290 	Other machine operat not else class
8300 	Drivers and mobile plant operators
8310 	Locomotive engine drivers,related worker
8311 	Locomotive engine drivers
8312 	Railway brakers, signallers and shunters
8320 	Motor vehicle drivers
8321 	Motorcycle drivers
8322 	Car, taxi and van drivers
8323 	Bus and tram drivers
8324 	Heavy truck and lorry drivers
8330 	Agricultural,other mobile plant operator
8331 	Motorised farm, forestry plant operator
8332 	Earth-moving and related plant operators
8333 	Crane, hoist and related plant operators
8334 	Lifting-truck operators
8340 	Ships' deck crews and related workers
9000 	Elementary occupations
9100 	Sales and services elementary occupations
9110 	Street vendors and related workers
9111 	Street vendors
9113 	Door-to-door and telephone salespersons
9120 	Shoe cleaning,other streetserv element occ
9130 	Domestic,related helpers,cleaner,launderer
9131 	Domestic helpers and cleaners
9132 	Helper,cleaner in office,hotel,other establ
9133 	Hand-launderers and pressers
9140 	Building caretakers,window, rel cleaner
9141 	Building caretakers
9142 	Vehicle, window and related cleaners
9150 	Messengers,porters doorkeepers,rel worker
9151 	Messengers,package,luggage porter, deliverer
9152 	Doorkeepers,watchpersons,related worker
9153 	Vendingm,money collect, meter reader,rel work
9160 	Garbage collectors and related labourers
9161 	Garbage collectors
9162 	Sweepers and related labourers
9200 	Agricultural,fishery,related labourers
9210 	Agricultural,fishery,related labourers
9211 	Farm-hands and labourers
9212 	Forestry labourers
9213 	Fishery, hunting and trapping labourers
9300 	Labourer mining,construction,manufact,transp
9310 	Mining and construction labourers
9311 	Mining and quarrying labourers
9312 	Constr,mainten labour: roads,dams,sim constr
9313 	Building construction labourers
9320 	Manufacturing labourers
9330 	Transport laborers and freight handlers
66666 	Not applicable*
77777 	Refusal*
88888 	Don't know*
99999 	No answer*

*) Missing Value
emprelp
Partner's employment relation
In his/her main job is he/she...
READ OUT
Value 	Category
1 	Employee
2 	Self-employed
3 	Working for own family business
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
emplnop
Number of employees partner has
How many employees (if any) does he/she have?
WRITE IN NUMBER
Value 	Category
66666 	Not applicable*
77777 	Refusal*
88888 	Don't know*
99999 	No answer*

*) Missing Value
jbspvp
Partner responsible for supervising other employees
ASK IF PARTNER IN PAID WORK AT F35a OR F36
In his/her main job, does he/she have any responsibility for supervising the work of other employees?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
njbspvp
Number of people partner responsible for in job
How many people is he/she responsible for?
WRITE IN NUMBER
Value 	Category
66666 	Not applicable*
77777 	Refusal*
88888 	Don't know*
99999 	No answer*

*) Missing Value
wkhtotp
Hours normally worked a week in main job overtime included, partner
ASK IF PARTNER IN PAID WORK AT F35a OR F36
How many hours does he/she normally work a week (in his/her main job)? Please include any paid or unpaid overtime.
WRITE IN HOURS
Value 	Category
666 	Not applicable*
777 	Refusal*
888 	Don't know*
999 	No answer*

*) Missing Value
edulvlfa
Father's highest level of education
ASK ALL CARD 61
What is the highest level of education your father achieved?
Please use this card
Value 	Category
0 	Not possible to harmonise into 5-level ISCED
1 	Less than lower secondary education (ISCED 0-1)
2 	Lower secondary education completed (ISCED 2)
3 	Upper secondary education completed (ISCED 3)
4 	Post-secondary non-tertiary education completed (ISCED 4)
5 	Tertiary education completed (ISCED 5-6)
55 	Other
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
emprf14
Father's employment status when respondent 14
When you were 14, did your father work as an employee, was he self-employed, or was he not working then?
Value 	Category
1 	Employee
2 	Self-employed
3 	Not working
4 	Father dead/absent
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
emplnof
Number of employees father had
How many employees did he have?
Value 	Category
1 	None
2 	1 to 24
3 	25 or more
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
jbspvf
Father responsible for supervising other employees
ASK IF FATHER EMPLOYED (code 1 at F46)
Did he have any responsibility for supervising the work of other employees?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
occf14
Father's occupation when respondent 14
CARD 62
Which of the descriptions on this card best describes the sort of work he did when you were 14
Value 	Category
1 	Traditional professional occupations
2 	Modern professional occupations
3 	Clerical and intermediate occupations
4 	Senior manager or administrators
5 	Technical and craft occupations
6 	Semi-routine/manual/service occupations
7 	Routine manual and service occupations
8 	Middle or junior managers
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
occf14ie
Father's occupation when respondent 14, Ireland
Which of the descriptions on this card best describes the sort of work he did when you were 14 (Ireland)
Value 	Category
1 	Traditional professional occupations
2 	Modern professional occupations
3 	Clerical and intermediate occupations
4 	Senior manager or administrators
5 	Technical and craft occupations
6 	Semi-routine/manual/service occupations
7 	Routine manual and service occupations
8 	Middle or junior managers
9 	Farmer
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
edulvlma
Mother's highest level of education
ASK ALL CARD 63
What is the highest level of education your mother achieved?
Please use this card
Value 	Category
0 	Not possible to harmonise into 5-level ISCED
1 	Less than lower secondary education (ISCED 0-1)
2 	Lower secondary education completed (ISCED 2)
3 	Upper secondary education completed (ISCED 3)
4 	Post-secondary non-tertiary education completed (ISCED 4)
5 	Tertiary education completed (ISCED 5-6)
55 	Other
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
emprm14
Mother's employment status when respondent 14
When you were 14, did your mother work as an employee, was she self-employed, or was she not working then?
Value 	Category
1 	Employee
2 	Self-employed
3 	Not working
4 	Mother dead/absent
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
emplnom
Number of employees mother had
How many employees did she have?
Value 	Category
1 	None
2 	1 to 24
3 	25 or more
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
jbspvm
Mother responsible for supervising other employees
ASK IF MOTHER EMPLOYED (code 1 at F52)
Did she have any responsibility for supervising the work of other employees?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
occm14
Mother's occupation when respondent 14
CARD 64
Which of the descriptions on this card best describes the sort of work she did when you were 14
Value 	Category
1 	Traditional professional occupations
2 	Modern professional occupations
3 	Clerical and intermediate occupations
4 	Senior manager or administrators
5 	Technical and craft occupations
6 	Semi-routine/manual/service occupations
7 	Routine manual and service occupations
8 	Middle or junior managers
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
occm14ie
Mother's occupation when respondent 14, Ireland
Which of the descriptions on this card best describes the sort of work she did when you were 14 (Ireland)
Value 	Category
1 	Traditional professional occupations
2 	Modern professional occupations
3 	Clerical and intermediate occupations
4 	Senior manager or administrators
5 	Technical and craft occupations
6 	Semi-routine/manual/service occupations
7 	Routine manual and service occupations
8 	Middle or junior managers
9 	Farmer
66 	Not applicable*
77 	Refusal*
88 	Don't know*
99 	No answer*

*) Missing Value
atncrse
Improve knowledge/skills: course/lecture/conference, last 12 months
ASK ALL
During the last twelve months, have you taken any course or attended any lecture or conference to improve your knowledge or skills for work?
Value 	Category
1 	Yes
2 	No
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
marital
Legal marital status
CARD 65
Could I ask about your current legal marital status? Which of the descriptions on this card applies to you?
Value 	Category
1 	Married
2 	Separated
3 	Divorced
4 	Widowed
5 	Never married
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
martlfr
Legal marital status, France
Could I ask about your current legal marital status? Which of the descriptions on this card applies to you?
Value 	Category
1 	Married
2 	Separated
3 	Divorced
4 	Widowed
5 	Never married
6 	Pacte de solididarité
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
lvghw
Currently living with husband/wife
Are you currently living with your husband/wife?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
lvgoptn
Currently living with another partner than husband/wife
Are you currently living with another partner?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
lvgptn
Currently living with partner
Are you currently living with a partner?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
lvgptne
Ever lived with a partner without being married
Have you ever lived with a partner without being married to them?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
dvrcdev
Ever been divorced
ASK ALL MARRIED, SEPARATED OR WIDOWED (CODES 1, 2 OR 4) AT F58. OTHERS GO TO F64.
May I just check, have you ever been divorced?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
chldhm
Children living at home or not
ASK ALL. INTERVIEWER REFER TO HOUSEHOLD GRID AND CODE:
INTERVIEWER REFER TO HOUSEHOLD GRID AND CODE:
Value 	Category
1 	Respondent lives with children at household grid
2 	Does not
9 	Not available*

*) Missing Value
chldhhe
Ever had children living in household
Have you ever had any children of your own, step-children, adopted children, foster children or a partner's children living in your household?
Value 	Category
1 	Yes
2 	No
6 	Not applicable*
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
regionat
Region, Austria
Value 	Category
1 	Burgenland
2 	Kärnten
3 	Niederösterreich
4 	Oberösterreich
5 	Salzburg
6 	Steiermark
7 	Tirol
8 	Vorarlberg
9 	Wien
999 	Not available*

*) Missing Value
regionbe
Region, Belgium
Value 	Category
1 	Flemish region
2 	Brussels region
3 	Walloon region
999 	Not available*

*) Missing Value
regioach
Region, Switzerland
Value 	Category
1 	Région lémanique
2 	Espace Mittelland
3 	Nordwestschweiz
4 	Zürich
5 	Ostschweiz
6 	Zentralschweiz
7 	Ticino
999 	Not available*

*) Missing Value
regioncz
Region, Czechia
Value 	Category
1 	Prague
2 	Central Bohemia
3 	South Bohemia
4 	Plzen Reg.
5 	Karlovy Vary Reg.
6 	Usti Reg.
7 	Liberec Reg.
8 	Hradec Kralove Reg.
9 	Pardubice Reg.
10 	Vysocina
11 	South Moravia
12 	Olomouc Reg.
13 	Zlin Reg.
14 	Moravian Silesia Reg.
999 	Not available*

*) Missing Value
regionde
Region, Germany
Value 	Category
1 	Schleswig-Holstein
2 	Hamburg
3 	Niedersachsen
4 	Bremen
5 	Nordrhein-Westfalen
6 	Hessen
7 	Rheinland-Pfalz
8 	Baden-Württemberg
9 	Bayern
10 	Saarland
11 	Berlin
12 	Brandenburg
13 	Mecklenburg-Vorpommern
14 	Sachsen
15 	Sachsen-Anhalt
16 	Thüringen
999 	Not available*

*) Missing Value
regiondk
Region, Denmark
Value 	Category
1 	Københavns og Frederiksberg Kommune
2 	Københavns Amt
3 	Frederiksborg Amt
4 	Roskilde Amt
5 	Vestsjællands Amt
6 	Storstrøms Amt
7 	Bornholms Amt
8 	Fyns Amt
9 	Sønderjyllands Amt
10 	Ribe Amt
11 	Vejle Amt
12 	Ringkøbing Amt
13 	Århus Amt
14 	Viborg Amt
15 	Nordjyllands Amt
999 	Not available*

*) Missing Value
regiones
Region, Spain
Value 	Category
11 	Galicia
12 	Principado de Asturias
13 	Cantabria
21 	País Vasco
22 	Comunidad Foral de Navarra
23 	La Rioja
24 	Aragón
30 	Comunidad de Madrid
41 	Castilla y León
42 	Castilla-la Mancha
43 	Extremadura
51 	Cataluña
52 	Comunidad Valenciana
53 	Illes Balears
61 	Andalucía
62 	Región de Murcia
63 	Ceuta y Melilla
70 	Canarias
999 	Not available*

*) Missing Value
regionfi
Region, Finland
Value 	Category
1 	Uusimaa
2 	Southern Finland and Åland
3 	Eastern Finland
4 	Mid Finland
5 	Northern Finland
999 	Not available*

*) Missing Value
regionfr
Region, France
Value 	Category
1 	Région parisienne
2 	Bassin Parisien Est
3 	Bassin Parisien Ouest
4 	Nord
5 	Est
6 	Ouest
7 	Sud Ouest
8 	Sud Est
9 	Méditerranée
999 	Not available*

*) Missing Value
regiongb
Region, United Kingdom
Value 	Category
1 	North East
2 	North West
3 	Yorkshire and The Humber
4 	East Midlands
5 	West Midlands
6 	South West
7 	East of England
8 	London
9 	South East
10 	Wales
11 	Scotland
12 	Northern Ireland
999 	Not available*

*) Missing Value
regiongr
Region, Greece
Value 	Category
3 	Attiki
11 	Anatoliki Makedonia, Thraki
12 	Kentriki Makedonia
13 	Dytiki Makedonia
14 	Thessalia
21 	Ipeiros
22 	Ionia Nissia
23 	Dytiki Ellada
24 	Sterea Ellada
25 	Peloponnisos
41 	Voreio Agaio
42 	Notio Agaio
43 	Kriti
999 	Not available*

*) Missing Value
regionhu
Region, Hungary
Value 	Category
1 	Central regio
2 	Middle- Transdanubia
3 	West- Transdanubia
4 	South-Transdanubia
5 	North Regio
6 	North- Plain
7 	South- Plain
999 	Not available*

*) Missing Value
regionie
Region, Ireland
Value 	Category
1 	Border
2 	Midland
3 	West
4 	Dublin
5 	Mid-East
6 	Mid-West
7 	South-East
8 	South-West
999 	Not available*

*) Missing Value
regionil
Region, Israel
Value 	Category
1 	Jerusalem
2 	Northern
3 	Haifa
4 	Central
5 	Tel Aviv
6 	Southern
7 	Judea - Samaria and Gaza
999 	Not available*

*) Missing Value
regionit
Region, Italy
Value 	Category
1 	Piemonte
2 	Valle d'Aosta
3 	Lombardia
4 	Trentino-Alto Adige
5 	Veneto
6 	Friuli-Venezia Giulia
7 	Liguria
8 	Emilia-Romagna
9 	Toscana
10 	Umbria
11 	Marche
12 	Lazio
13 	Abruzzo
14 	Molise
15 	Campania
16 	Puglia
17 	Basilicata
18 	Calabria
19 	Sicilia
20 	Sardegna
999 	Not available*

*) Missing Value
regionlu
Region, Luxembourg
Value 	Category
1 	Luxembourg
999 	Not available*

*) Missing Value
regionnl
Region, Netherlands
Value 	Category
111 	Oost-Groningen
112 	Delfzijl en omgeving
113 	Overig Groningen
121 	Noord-Friesland
122 	Zuidwest-Friesland
123 	Zuidoost-Friesland
131 	Noord-Drenthe
132 	Zuidoost-Drenthe
133 	Zuidwest-Drenthe
211 	Noord-Overijssel
212 	Zuidwest-Overijssel
213 	Twente
221 	Veluwe
222 	Achterhoek
223 	Arnhem/Nijmegen
224 	Zuidwest-Gelderland
230 	Flevoland
310 	Utrecht
321 	Kop van Noord-Holland
322 	Alkmaar en omgeving
323 	IJmond
324 	Agglomeratie Haarlem
325 	Zaanstreek
326 	Groot-Amsterdam
327 	Het Gooi en Vechtstreek
331 	Agglomeratie Leiden en Bollenstreek
332 	Agglomeratie's-Gravenhage
333 	Delft en Westland
334 	Oost-Zuid-Holland
335 	Groot-Rijnmond
336 	Zuidoost-Zuid-Holland
341 	Zeeuwsch-Vlaanderen
342 	Overig Zeeland
411 	West-Noord-Brabant
412 	Midden-Noord-Brabant
413 	Noordoost-Noord-Brabant
414 	Zuidoost-Noord-Brabant
421 	Noord-Limburg
422 	Midden-Limburg
423 	Zuid-Limburg
999 	Not available*

*) Missing Value
regionno
Region, Norway
Value 	Category
1 	Oslo and Akershus
2 	Hedmark and Oppland
3 	South Eastern Norway
4 	Agder and Rogaland
5 	Western Norway
6 	Trøndelag
7 	Northern Norway
999 	Not available*

*) Missing Value
regionpl
Region, Poland
Value 	Category
2 	Dolnoslaskie
4 	Kujawsko-pomorskie
6 	Lubelskie
8 	Lubuskie
10 	Lodzkie
12 	Malopolskie
14 	Mazowieckie
16 	Opolskie
18 	Podkarpackie
20 	Podlaskie
22 	Pomorskie
24 	Slaskie
26 	Swietokrzyskie
28 	Warminsko-mazurskie
30 	Wielkopolskie
32 	Zachodniopomorskie
999 	Not available*

*) Missing Value
regionpt
Region, Portugal
Value 	Category
1 	Norte
2 	Centro
3 	Lisboa e Vale do Tejo
4 	Alentejo
5 	Algarve
999 	Not available*

*) Missing Value
regionse
Region, Sweden
Value 	Category
1 	Stockholm
2 	Östra Mellansverige
3 	Sydsverige
4 	Norra Mellansverige
5 	Mellersta Norrland
6 	Övre Norrland
7 	Småland med Öarna
8 	Västsverige
999 	Not available*

*) Missing Value
regionsi
Region, Slovenia
Value 	Category
1 	Gorenjska
2 	Goriska
3 	Jugovzhodna Slovenija
4 	Koroska
5 	Notranjsko-kraska
6 	Obalno-kraska
7 	Osrednjeslovenska
8 	Podravska
9 	Pomurska
10 	Savinjska
11 	Spodnjeposavska
12 	Zasavska
999 	Not available*

*) Missing Value
intewde
Place of interview: East, West Germany
PLEASE FILL OUT WITHOUT ASKING
Interview in East or West Germany
Value 	Category
1 	Interview takes place in East Germany, East Berlin
2 	Interview takes place in West Germany, West Berlin
ipcrtiv
Important to think new ideas and being creative
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. Thinking up new ideas and being creative is important to her/him. She/he likes to do things in her/his own original way.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imprich
Important to be rich, have money and expensive things
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him to be rich. She/he wants to have a lot of money and expensive things.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipeqopt
Important that people are treated equally and have equal opportunities
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. She/he thinks it is important that every person in the world should be treated equally. She/he believes everyone should have equal opportunities in life.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipshabt
Important to show abilities and be admired
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It's important to her/him to show her/his abilities. She/he wants people to admire what she/he does.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
impsafe
Important to live in secure and safe surroundings
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him to live in secure surroundings. She/he avoids anything that might endanger her/his safety.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
impdiff
Important to try new and different things in life
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. She/he likes surprises and is always looking for new things to do. She/he thinks it is important to do lots of different things in life.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipfrule
Important to do what is told and follow rules
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. She/he believes that people should do what they're told. She/he thinks people should follow rules at all times, even when no-one is watching.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipudrst
Important to understand different people
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him to listen to people who are different from her/him. Even when she/he disagrees with them, she/he still wants to understand them.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipmodst
Important to be humble and modest, not draw attention
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him to be humble and modest. She/he tries not to draw attention to herself/himself.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipgdtim
Important to have a good time
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. Having a good time is important to her/him. She/he likes to 'spoil' herself/himself.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
impfree
Important to make own decisions and be free
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him to make her/his own decisions about what she/he does. She/he likes to be free and not depend on others.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
iphlppl
Important to help people and care for others well-being
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It's very important to her/him to help the people around her/him. She/he wants to care for their well-being.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipsuces
Important to be successful and that people recognize achievements
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. Being very successful is important to her/him. She/he hopes people will recognise her/his achievements.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipstrgv
Important that government is strong and ensures safety
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him that the government ensures her/his safety against all threats. She/he wants the state to be strong so it can defend its citizens.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipadvnt
Important to seek adventures and have an exciting life
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. She/he looks for adventures and likes to take risks. She/he wants to have an exciting life.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
ipbhprp
Important to behave properly
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him always to behave properly. She/he wants to avoid doing anything people would say is wrong.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
iprspot
Important to get respect from others
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him to get respect from others. She/he wants people to do what she/he says.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
iplylfr
Important to be loyal to friends and devote to people close
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. It is important to her/him to be loyal to her/his friends. She/he wants to devote herself/himself to people close to her/him.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
impenv
Important to care for nature and environment
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. She/he strongly believes that people should care for nature. Looking after the environment is important to her/him.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
imptrad
Important to follow traditions and customs
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. Tradition is important to her/him. She/he tries to follow the customs handed down by her/his religion or her/his family.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
impfun
Important to seek fun and things that give pleasure
INTERVIEWER: IF RESPONDENT IS MALE, ASK GF1. IF RESPONDENT IS FEMALE, ASK GF2.. CARD A
Now I will briefly describe some people. Please listen to each description and tell me how much each person is or is not like you. Use this card for your answer. She/he seeks every chance she/he can to have fun. It is important to her/him to do things that give her/him pleasure.
Use this card for your answer
Value 	Category
1 	Very much like me
2 	Like me
3 	Somewhat like me
4 	A little like me
5 	Not like me
6 	Not like me at all
7 	Refusal*
8 	Don't know*
9 	No answer*

*) Missing Value
inwdd
Day of month of interview
Value 	Category
99 	Not available*

*) Missing Value
inwmm
Month of interview
Value 	Category
99 	Not available*

*) Missing Value
inwyr
Year of interview
Value 	Category
9999 	Not available*

*) Missing Value
inwshh
Start of interview, hour
Value 	Category
99 	Not available*

*) Missing Value
inwsmm
Start of interview, minute
Value 	Category
99 	Not available*

*) Missing Value
inwemm
End of interview, minute
Value 	Category
99 	Not available*

*) Missing Value
inwehh
End of interview, hour
Value 	Category
99 	Not available*

*) Missing Value
inwtm
Interview length in minutes, main questionnaire
Interview length in minutes, main questionnaire (calculated)
spltadm
Administration of split ballot and MTMM
Administration of split ballot and mtmm
Value 	Category
1 	SC2 TEST1-18
2 	SC2 TEST19-36
3 	SC6 TEST1-6
4 	SC6 TEST7-12
5 	SC6 TEST13-18
6 	SC6 TEST19-24
7 	SC6 TEST25-30
8 	SC6 TEST31-36
9 	FF2 TEST1-18
10 	FF2 TEST19-36
11 	FF6 TEST1-6
12 	FF6 TEST7-12
13 	FF6 TEST13-18
14 	FF6 TEST19-24
15 	FF6 TEST25-30
16 	FF6 TEST31-36
21 	SC No split
22 	FF No split
99 	Not available*

*) Missing Value
supqadm
Administration of supplementary questionnaire
How was the supplementary questionnaire administered?
Value 	Category
1 	Face-to-face interview
2 	Completed by respondent, you present
3 	Left with respondent, collected by you
4 	Left by respondent, returned by post
9 	No answer*

*) Missing Value
gndr
Gender
CODE SEX, respondent
Value 	Category
1 	Male
2 	Female
9 	No answer*

*) Missing Value
`;

export default function CodebookPanel() {
  const [content, setContent] = useState('');

  // We are using a hardcoded string here because Next.js/Webpack can have trouble
  // with `fs` in client components. In a production app, this content would
  // likely be fetched from an API endpoint.
  useEffect(() => {
    setContent(codebookText);
  }, []);

  if (!content) {
    return (
      <div className="flex h-[65vh] flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading codebook...</p>
      </div>
    );
  }
  
  return (
    <div className="flex h-[65vh] flex-col">
      <ScrollArea className="flex-1 rounded-md border p-4">
        <pre className="text-sm whitespace-pre-wrap font-sans">{content}</pre>
      </ScrollArea>
    </div>
  );
}
