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
gndr
Gender
CODE SEX, respondent
Value 	Category
1 	Male
2 	Female
9 	No answer*
`

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
